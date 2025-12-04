import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProgressModal from './ProgressModal';
import './LongVideo.css';

function LongVideo({ projectId, longVideoId, onClose, onSuccess }) {
  const isEditMode = !!longVideoId;
  
  const [createVideos, setCreateVideos] = useState([]);
  const [formData, setFormData] = useState({
    name: '',
    titles: [''],
    descriptions: [''],
    tags: '',
    thumbnails_folder: '',
    create_video_sequence: [],
    status: 'draft',
    schedule_type: null
  });

  const [uploadedThumbnails, setUploadedThumbnails] = useState([]);
  const [uploading, setUploading] = useState({ thumbnails: false });
  const [publishType, setPublishType] = useState('save');
  const [scheduledDate, setScheduledDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('generating');
  const [progressMessage, setProgressMessage] = useState('');
  
  // Portal Schedule fields
  const [portalTime, setPortalTime] = useState('07:00');
  
  // YouTube Schedule fields (same as CreateVideo)
  const [youtubeTotalVideos, setYoutubeTotalVideos] = useState(10);
  const [youtubeVideosPerDay, setYoutubeVideosPerDay] = useState(3);
  const [youtubeTimes, setYoutubeTimes] = useState(['10:00', '14:00', '18:00']);

  useEffect(() => {
    fetchCreateVideos();
    if (isEditMode) {
      fetchLongVideo();
    }
  }, [projectId, longVideoId, isEditMode]);

  const fetchCreateVideos = async () => {
    try {
      const response = await axios.get(`/api/create-videos/project/${projectId}`);
      setCreateVideos(response.data);
    } catch (error) {
      console.error('Error fetching create videos:', error);
    }
  };

  const fetchLongVideo = async () => {
    try {
      const response = await axios.get(`/api/long-videos/${longVideoId}`);
      const lv = response.data;
      
      // Safe parse JSON or handle plain string
      const parseSafe = (value) => {
        if (!value) return [];
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch (e) {
            // Not JSON, treat as plain string
            return [value];
          }
        }
        return Array.isArray(value) ? value : [];
      };
      
      // Parse titles and descriptions (JSON arrays or plain strings)
      const titles = parseSafe(lv.title);
      const descriptions = parseSafe(lv.description);
      
      setFormData({
        name: lv.name || '',
        titles: titles.length > 0 ? titles : [''],
        descriptions: descriptions.length > 0 ? descriptions : [''],
        tags: lv.tags || '',
        thumbnails_folder: lv.thumbnails_folder || '',
        create_video_sequence: parseSafe(lv.create_video_sequence),
        status: lv.status || 'draft',
        schedule_type: lv.schedule_type || null
      });

      // Fetch uploaded thumbnails
      if (lv.thumbnails_folder) fetchUploadedFiles('thumbnails');
    } catch (error) {
      console.error('Error fetching long video:', error);
      setError('Failed to load long video data');
    }
  };

  const fetchUploadedFiles = async (type) => {
    try {
      const response = await axios.get(`/api/upload/${projectId}/${longVideoId || 'temp'}/${type}`);
      if (type === 'thumbnails') setUploadedThumbnails(response.data.files || []);
    } catch (error) {
      console.error(`Error fetching ${type}:`, error);
    }
  };

  const handleFileUpload = async (type, files) => {
    if (!files || files.length === 0) return;

    setUploading(prev => ({ ...prev, [type]: true }));
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));

      const longVideoIdToUse = longVideoId || 'temp';
      const response = await axios.post(
        `/api/upload/${projectId}/${longVideoIdToUse}/${type}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      // Update folder path in formData
      if (response.data.folder) {
        setFormData(prev => ({ ...prev, [`${type}_folder`]: response.data.folder }));
      }

      // Refresh file list
      await fetchUploadedFiles(type);
      alert(`${files.length} file(s) uploaded successfully!`);
    } catch (error) {
      alert('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(prev => ({ ...prev, [type]: false }));
    }
  };

  const handleDeleteFile = async (type, filename) => {
    if (!window.confirm('Delete this file?')) return;

    try {
      const longVideoIdToUse = longVideoId || 'temp';
      await axios.delete(`/api/upload/${projectId}/${longVideoIdToUse}/${type}/${filename}`);
      await fetchUploadedFiles(type);
    } catch (error) {
      alert('Delete failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const addTitle = () => {
    setFormData(prev => ({
      ...prev,
      titles: [...prev.titles, '']
    }));
  };

  const removeTitle = (index) => {
    if (formData.titles.length > 1) {
      setFormData(prev => ({
        ...prev,
        titles: prev.titles.filter((_, i) => i !== index)
      }));
    }
  };

  const updateTitle = (index, value) => {
    setFormData(prev => ({
      ...prev,
      titles: prev.titles.map((t, i) => i === index ? value : t)
    }));
  };

  const addDescription = () => {
    setFormData(prev => ({
      ...prev,
      descriptions: [...prev.descriptions, '']
    }));
  };

  const removeDescription = (index) => {
    setFormData(prev => ({
      ...prev,
      descriptions: prev.descriptions.filter((_, i) => i !== index)
    }));
  };

  const updateDescription = (index, value) => {
    setFormData(prev => ({
      ...prev,
      descriptions: prev.descriptions.map((d, i) => i === index ? value : d)
    }));
  };

  const addCreateVideo = (cvId) => {
    setFormData(prev => {
      const sequence = [...prev.create_video_sequence];
      sequence.push(cvId); // Always add, allow duplicates
      return { ...prev, create_video_sequence: sequence };
    });
  };

  const removeCreateVideo = (index) => {
    setFormData(prev => {
      const sequence = [...prev.create_video_sequence];
      sequence.splice(index, 1);
      return { ...prev, create_video_sequence: sequence };
    });
  };

  const moveUp = (index) => {
    if (index === 0) return;
    const sequence = [...formData.create_video_sequence];
    [sequence[index - 1], sequence[index]] = [sequence[index], sequence[index - 1]];
    setFormData(prev => ({ ...prev, create_video_sequence: sequence }));
  };

  const moveDown = (index) => {
    if (index === formData.create_video_sequence.length - 1) return;
    const sequence = [...formData.create_video_sequence];
    [sequence[index], sequence[index + 1]] = [sequence[index + 1], sequence[index]];
    setFormData(prev => ({ ...prev, create_video_sequence: sequence }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.create_video_sequence.length === 0) {
      setError('Please select at least one Create Video');
      setLoading(false);
      return;
    }

    // Validate at least one title
    const validTitles = formData.titles.filter(t => t.trim());
    if (validTitles.length === 0) {
      setError('At least one title is required');
      setLoading(false);
      return;
    }

    // Validate thumbnails
    if (!formData.thumbnails_folder && uploadedThumbnails.length === 0) {
      setError('Please upload thumbnails or provide thumbnails folder');
      setLoading(false);
      return;
    }

    try {
      let longVideoIdToUse = longVideoId;

      // Create or update long video
      if (isEditMode) {
        await axios.put(`/api/long-videos/${longVideoId}`, {
          ...formData,
          title: validTitles,
          description: formData.descriptions.filter(d => d.trim()),
          thumbnails_folder: formData.thumbnails_folder || (uploadedThumbnails.length > 0 ? `data/uploads/${projectId}/temp/thumbnails` : '')
        });
      } else {
        const createResponse = await axios.post('/api/long-videos', {
          ...formData,
          project_id: projectId,
          title: validTitles,
          description: formData.descriptions.filter(d => d.trim()),
          thumbnails_folder: formData.thumbnails_folder || (uploadedThumbnails.length > 0 ? `data/uploads/${projectId}/temp/thumbnails` : '')
        });
        longVideoIdToUse = createResponse.data.id;
      }

      // If not just saving, generate and publish with progress
      if (publishType !== 'save') {
        // Show progress modal
        setShowProgress(true);
        setProgress(0);
        setCurrentStep('generating');
        setProgressMessage('Preparing to generate long video...');

        try {
          // Step 1: Preparing (0-10%)
          setProgressMessage('Preparing to generate videos...');
          for (let i = 0; i <= 10; i++) {
            setProgress(i);
            await new Promise(resolve => setTimeout(resolve, 30));
          }

          // Step 2: Generating individual videos (10-50%)
          const sequenceLength = formData.create_video_sequence.length;
          setProgressMessage(`Generating ${sequenceLength} videos (this may take a few minutes)...`);
          
          for (let i = 10; i <= 50; i++) {
            setProgress(i);
            const videoIndex = Math.floor((i - 10) / 40 * sequenceLength);
            if (videoIndex < sequenceLength) {
              setProgressMessage(`Generating video ${videoIndex + 1} of ${sequenceLength}...`);
            }
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          // Step 3: Merging videos (50-70%)
          setProgressMessage('Merging all videos into one long video...');
          for (let i = 50; i <= 70; i++) {
            setProgress(i);
            await new Promise(resolve => setTimeout(resolve, 100));
          }

          // Switch to uploading step
          setCurrentStep('uploading');
          setProgressMessage('Long video generated! Starting upload to YouTube...');
          await new Promise(resolve => setTimeout(resolve, 500));
          setProgress(75);

          // Make the actual API call
          const startTime = Date.now();
          
          // Start upload progress simulation
          const uploadInterval = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const estimatedTotal = 60000; // Estimate 60 seconds for long video upload
            const uploadProgress = Math.min(75 + Math.floor((elapsed / estimatedTotal) * 20), 95);
            setProgress(uploadProgress);
            const percent = Math.min(Math.floor((elapsed / estimatedTotal) * 100), 100);
            setProgressMessage(`Uploading to YouTube... ${percent}%`);
          }, 500);

          // Handle different publish types
          if (publishType === 'portal') {
            // Portal Schedule
            try {
              const response = await axios.post(`/api/long-videos/${longVideoIdToUse}/portal-schedule`, {
                publish_time: portalTime
              });
              alert(`✅ Portal schedule configured!\n\nPublish Time: ${portalTime}`);
              onSuccess();
              onClose();
              return;
            } catch (err) {
              alert('Error setting portal schedule: ' + (err.response?.data?.error || err.message));
              setShowProgress(false);
              return;
            }
          } else if (publishType === 'youtube') {
            // YouTube Schedule
            try {
              setShowProgress(false); // Close progress modal, will show new one
              const response = await axios.post(`/api/long-videos/${longVideoIdToUse}/youtube-schedule`, {
                total_videos: youtubeTotalVideos,
                videos_per_day: youtubeVideosPerDay,
                times: youtubeTimes
              });
              alert(`✅ YouTube schedule completed!\n\nTotal videos: ${response.data.total}\nSuccessful: ${response.data.successful}\nFailed: ${response.data.failed || 0}`);
              onSuccess();
              onClose();
              return;
            } catch (err) {
              alert('Error scheduling YouTube videos: ' + (err.response?.data?.error || err.message));
              setShowProgress(false);
              return;
            }
          }

          // For instant publish, continue with normal flow
          // Make API call
          const generateResponse = await axios.post(`/api/long-videos/${longVideoIdToUse}/generate`, {
            publish_type: publishType,
            scheduled_date: scheduledDate
          });

          clearInterval(uploadInterval);
          setProgress(95);
          setProgressMessage('Finalizing upload...');
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Complete
          setCurrentStep('complete');
          setProgress(100);
          setProgressMessage('Long video published successfully!');

          // Wait a bit to show success, then close
          setTimeout(() => {
            setShowProgress(false);
            alert(`✅ ${generateResponse.data.message}`);
            onSuccess();
            onClose();
            // Reset progress
            setProgress(0);
            setCurrentStep('generating');
            setProgressMessage('');
          }, 2500);

        } catch (err) {
          setShowProgress(false);
          setError(err.response?.data?.error || err.message);
          // Reset progress
          setProgress(0);
          setCurrentStep('generating');
          setProgressMessage('');
        }
      } else {
        // Just save as draft
        alert('Long Video saved as draft!');
        onSuccess();
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="long-video-modal">
      <div className="modal-content large">
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Long Video' : 'Create Long Video'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Long Video Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
              placeholder="My Long Video"
            />
          </div>

          {/* Multiple Titles */}
          <div className="form-group">
            <label>Titles * (Multiple - Random Selection)</label>
            {formData.titles.map((title, index) => (
              <div key={index} className="multi-input-row">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => updateTitle(index, e.target.value)}
                  placeholder={`Title ${index + 1}`}
                  required={index === 0}
                />
                {formData.titles.length > 1 && (
                  <button type="button" onClick={() => removeTitle(index)} className="remove-btn">×</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addTitle} className="add-btn">+ Add Title</button>
          </div>

          {/* Multiple Descriptions */}
          <div className="form-group">
            <label>Descriptions (Multiple - Random Selection, Optional)</label>
            {formData.descriptions.map((desc, index) => (
              <div key={index} className="multi-input-row">
                <textarea
                  value={desc}
                  onChange={(e) => updateDescription(index, e.target.value)}
                  placeholder={`Description ${index + 1} (Optional)`}
                  rows="2"
                />
                <button type="button" onClick={() => removeDescription(index)} className="remove-btn">×</button>
              </div>
            ))}
            <button type="button" onClick={addDescription} className="add-btn">+ Add Description</button>
          </div>

          {/* Thumbnails Upload */}
          <div className="form-group">
            <label>Thumbnails *</label>
            <div className="upload-section">
              <div className="upload-area">
                <input
                  type="file"
                  id="thumbnails-upload"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleFileUpload('thumbnails', e.target.files)}
                  style={{ display: 'none' }}
                />
                <label htmlFor="thumbnails-upload" className="upload-btn">
                  {uploading.thumbnails ? 'Uploading...' : '🖼️ Upload Thumbnails (Multiple)'}
                </label>
                <span className="or-text">OR</span>
                <input
                  type="text"
                  name="thumbnails_folder"
                  value={formData.thumbnails_folder}
                  onChange={(e) => setFormData(prev => ({ ...prev, thumbnails_folder: e.target.value }))}
                  placeholder="Enter folder path"
                  className="folder-input"
                />
              </div>
              {uploadedThumbnails.length > 0 && (
                <div className="uploaded-files thumbnails-preview">
                  <strong>Uploaded ({uploadedThumbnails.length}):</strong>
                  <div className="thumbnails-grid">
                    {uploadedThumbnails.map((file, idx) => {
                      const lvId = longVideoId || 'temp';
                      const imageUrl = `/uploads/${projectId}/${lvId}/thumbnails/${file.filename}`;
                      return (
                        <div key={idx} className="thumbnail-item">
                          <img src={imageUrl} alt={`Thumbnail ${idx + 1}`} />
                          <div className="thumbnail-actions">
                            <button type="button" onClick={() => handleDeleteFile('thumbnails', file.filename)} className="delete-btn">Delete</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <label>Tags (comma separated)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="form-group">
            <label>Select Create Videos (in sequence) *</label>
            <small style={{ display: 'block', marginBottom: '12px', color: '#666' }}>
              You can add the same Create Video multiple times. Click on any video to add it to the sequence.
            </small>
            {createVideos.length === 0 ? (
              <p>No Create Videos available. Please create some first.</p>
            ) : (
              <div className="create-videos-selector">
                <div className="available-videos">
                  <h4>Available Create Videos</h4>
                  <p className="helper-text">Click to add to sequence (can add multiple times)</p>
                  {createVideos.map(cv => (
                    <button
                      key={cv.id}
                      type="button"
                      className="video-add-btn"
                      onClick={() => addCreateVideo(cv.id)}
                    >
                      <span className="add-icon">+</span>
                      <span className="video-info">
                        <strong>{cv.name}</strong>
                        <small>
                          {(() => {
                            if (!cv.title) return 'No title';
                            try {
                              const parsed = typeof cv.title === 'string' ? JSON.parse(cv.title) : cv.title;
                              return Array.isArray(parsed) ? parsed[0] : parsed;
                            } catch (e) {
                              return cv.title;
                            }
                          })()}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>

                <div className="selected-sequence">
                  <h4>Selected Sequence ({formData.create_video_sequence.length} videos)</h4>
                  {formData.create_video_sequence.length === 0 ? (
                    <div className="empty-sequence">
                      <p>No videos in sequence yet</p>
                      <small>Click on videos from the left to add them</small>
                    </div>
                  ) : (
                    <div className="sequence-list">
                      {formData.create_video_sequence.map((cvId, index) => {
                        const cv = createVideos.find(c => c.id === cvId);
                        const duplicateCount = formData.create_video_sequence.slice(0, index + 1).filter(id => id === cvId).length;
                        return (
                          <div key={`${cvId}-${index}`} className="sequence-item">
                            <span className="sequence-number">{index + 1}</span>
                            <span className="sequence-name">
                              {cv ? cv.name : `Video ${cvId}`}
                              {duplicateCount > 1 && (
                                <span className="duplicate-badge">#{duplicateCount}</span>
                              )}
                            </span>
                            <div className="sequence-actions">
                              <button
                                type="button"
                                onClick={() => moveUp(index)}
                                disabled={index === 0}
                                className="btn-icon"
                                title="Move up"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveDown(index)}
                                disabled={index === formData.create_video_sequence.length - 1}
                                className="btn-icon"
                                title="Move down"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => removeCreateVideo(index)}
                                className="btn-icon remove"
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Action *</label>
            <select
              value={publishType}
              onChange={(e) => setPublishType(e.target.value)}
              required
            >
              <option value="save">Save as Draft</option>
              <option value="instant">⚡ Instant Publish</option>
              <option value="portal">📅 Portal Schedule</option>
              <option value="youtube">📺 YouTube Schedule</option>
            </select>
          </div>

          {/* Portal Schedule Options */}
          {publishType === 'portal' && (
            <div className="form-group">
              <h3 style={{ marginBottom: '15px' }}>Portal Schedule Settings</h3>
              
              <div className="form-group">
                <label>Publish Time (IST) *</label>
                <input
                  type="time"
                  value={portalTime}
                  onChange={(e) => setPortalTime(e.target.value)}
                  required
                />
                <small>Time when the long video will be published daily</small>
              </div>
              
              <div className="info-box" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                <strong>ℹ️ Portal Schedule:</strong> The long video will be automatically generated and published at the specified time every day. This runs indefinitely (unlimited).
              </div>
            </div>
          )}

          {/* YouTube Schedule Options (same as CreateVideo) */}
          {publishType === 'youtube' && (
            <div className="form-group">
              <h3 style={{ marginBottom: '15px' }}>YouTube Schedule Settings</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Total Videos *</label>
                  <input
                    type="number"
                    value={youtubeTotalVideos}
                    onChange={(e) => setYoutubeTotalVideos(parseInt(e.target.value) || 1)}
                    min="1"
                    max="100"
                    required
                  />
                  <small>Total number of long videos to schedule</small>
                </div>

                <div className="form-group">
                  <label>Videos Per Day *</label>
                  <input
                    type="number"
                    value={youtubeVideosPerDay}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 1;
                      setYoutubeVideosPerDay(count);
                      // Adjust times array
                      if (count > youtubeTimes.length) {
                        // Add more times
                        const newTimes = [...youtubeTimes];
                        for (let i = youtubeTimes.length; i < count; i++) {
                          newTimes.push('10:00');
                        }
                        setYoutubeTimes(newTimes);
                      } else if (count < youtubeTimes.length) {
                        // Remove extra times
                        setYoutubeTimes(youtubeTimes.slice(0, count));
                      }
                    }}
                    min="1"
                    max="10"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Publish Times (IST) * - One for each video per day</label>
                {youtubeTimes.map((time, index) => (
                  <div key={index} className="multi-input-row" style={{ marginBottom: '10px' }}>
                    <label style={{ minWidth: '150px' }}>Video {index + 1} Time:</label>
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => {
                        const newTimes = [...youtubeTimes];
                        newTimes[index] = e.target.value;
                        setYoutubeTimes(newTimes);
                      }}
                      required
                    />
                  </div>
                ))}
                <small>All times are in IST (Indian Standard Time, UTC+5:30)</small>
              </div>
              
              <div className="info-box" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
                <strong>⚠️ YouTube Schedule:</strong> All long videos will be generated immediately and uploaded to YouTube with scheduled publish dates. This may take some time depending on the number of videos.
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing...' : isEditMode ? 'Update' : publishType === 'save' ? 'Save Draft' : 'Create & Publish'}
            </button>
          </div>
        </form>

        <ProgressModal
          isOpen={showProgress}
          progress={progress}
          currentStep={currentStep}
          message={progressMessage}
          onClose={() => {
            if (progress === 100) {
              setShowProgress(false);
              setProgress(0);
              setCurrentStep('generating');
              setProgressMessage('');
            }
          }}
        />
      </div>
    </div>
  );
}

export default LongVideo;
