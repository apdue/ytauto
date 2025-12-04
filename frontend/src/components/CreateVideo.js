import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CreateVideo.css';

function CreateVideo({ projectId, createVideoId, onClose, onSuccess }) {
  const isEditMode = !!createVideoId;
  
  const [formData, setFormData] = useState({
    name: '',
    clips_folder: '',
    audio_folder: '',
    thumbnails_folder: '',
    titles: [''],
    descriptions: [''],
    tags: '',
    publish_time: '07:00',
    videos_per_day: 1,
    start_date: '',
    end_date: '',
    is_unlimited: false,
    status: 'draft'
  });

  const [uploadedClips, setUploadedClips] = useState([]);
  const [uploadedAudio, setUploadedAudio] = useState([]);
  const [uploadedThumbnails, setUploadedThumbnails] = useState([]);
  const [uploading, setUploading] = useState({ clips: false, audio: false, thumbnails: false });
  const [publishType, setPublishType] = useState('save');
  const [scheduledDate, setScheduledDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Portal Schedule fields
  const [portalTime, setPortalTime] = useState('07:00');
  const [portalGap, setPortalGap] = useState('daily');
  const [portalVideosPerDay, setPortalVideosPerDay] = useState(1);
  
  // YouTube Schedule fields
  const [youtubeTotalVideos, setYoutubeTotalVideos] = useState(10);
  const [youtubeVideosPerDay, setYoutubeVideosPerDay] = useState(3);
  const [youtubeTimes, setYoutubeTimes] = useState(['10:00', '14:00', '18:00']);

  useEffect(() => {
    if (isEditMode) {
      fetchCreateVideo();
    }
  }, [createVideoId, isEditMode]);

  const fetchCreateVideo = async () => {
    try {
      const response = await axios.get(`/api/create-videos/${createVideoId}`);
      const cv = response.data;
      
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
      const titles = parseSafe(cv.title);
      const descriptions = parseSafe(cv.description);
      
      setFormData({
        name: cv.name || '',
        clips_folder: cv.clips_folder || '',
        audio_folder: cv.audio_folder || '',
        thumbnails_folder: cv.thumbnails_folder || '',
        titles: titles.length > 0 ? titles : [''],
        descriptions: descriptions.length > 0 ? descriptions : [''],
        tags: cv.tags || '',
        publish_time: cv.publish_time || '07:00',
        videos_per_day: cv.videos_per_day || 1,
        start_date: cv.start_date || '',
        end_date: cv.end_date || '',
        is_unlimited: cv.is_unlimited === 1,
        status: cv.status || 'draft'
      });

      // Fetch uploaded files
      if (cv.clips_folder) fetchUploadedFiles('clips');
      if (cv.audio_folder) fetchUploadedFiles('audio');
      if (cv.thumbnails_folder) fetchUploadedFiles('thumbnails');
    } catch (error) {
      console.error('Error fetching create video:', error);
      setError('Failed to load video data');
    }
  };

  const fetchUploadedFiles = async (type) => {
    try {
      const response = await axios.get(`/api/upload/${projectId}/${createVideoId || 'temp'}/${type}`);
      if (type === 'clips') setUploadedClips(response.data.files || []);
      else if (type === 'audio') setUploadedAudio(response.data.files || []);
      else if (type === 'thumbnails') setUploadedThumbnails(response.data.files || []);
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

      const createVideoIdToUse = createVideoId || 'temp';
      const response = await axios.post(
        `/api/upload/${projectId}/${createVideoIdToUse}/${type}`,
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
      const createVideoIdToUse = createVideoId || 'temp';
      await axios.delete(`/api/upload/${projectId}/${createVideoIdToUse}/${type}/${filename}`);
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

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate at least one title
    const validTitles = formData.titles.filter(t => t.trim());
    if (validTitles.length === 0) {
      setError('At least one title is required');
      setLoading(false);
      return;
    }

    // Validate folders or uploaded files
    if (!formData.clips_folder && uploadedClips.length === 0) {
      setError('Please upload clips or provide clips folder');
      setLoading(false);
      return;
    }
    if (!formData.audio_folder && uploadedAudio.length === 0) {
      setError('Please upload audio or provide audio folder');
      setLoading(false);
      return;
    }
    if (!formData.thumbnails_folder && uploadedThumbnails.length === 0) {
      setError('Please upload thumbnails or provide thumbnails folder');
      setLoading(false);
      return;
    }

    try {
      let createVideoIdToUse = createVideoId;

      // Create or update create_video record
      if (isEditMode) {
        await axios.put(`/api/create-videos/${createVideoId}`, {
          ...formData,
          title: validTitles,
          description: formData.descriptions.filter(d => d.trim())
        });
      } else {
        const createResponse = await axios.post('/api/create-videos', {
          ...formData,
          project_id: projectId,
          title: validTitles,
          description: formData.descriptions.filter(d => d.trim()),
          clips_folder: formData.clips_folder || (uploadedClips.length > 0 ? `data/uploads/${projectId}/temp/clips` : ''),
          audio_folder: formData.audio_folder || (uploadedAudio.length > 0 ? `data/uploads/${projectId}/temp/audio` : ''),
          thumbnails_folder: formData.thumbnails_folder || (uploadedThumbnails.length > 0 ? `data/uploads/${projectId}/temp/thumbnails` : '')
        });
        createVideoIdToUse = createResponse.data.id;
      }

      // If publishing, handle accordingly
      if (publishType === 'instant') {
        try {
          const publishResponse = await axios.post(`/api/create-videos/${createVideoIdToUse}/instant-publish`);
          alert(`✅ Video published instantly!\n\nURL: ${publishResponse.data.url}`);
        } catch (err) {
          alert('Error publishing: ' + (err.response?.data?.error || err.message));
        }
      } else if (publishType === 'portal') {
        // Portal Schedule
        try {
          const response = await axios.post(`/api/create-videos/${createVideoIdToUse}/portal-schedule`, {
            publish_time: portalTime,
            schedule_gap: portalGap,
            videos_per_day: portalVideosPerDay
          });
          alert(`✅ Portal schedule configured!\n\nPublish Time: ${portalTime}\nGap: ${portalGap}\nVideos per day: ${portalVideosPerDay}`);
        } catch (err) {
          alert('Error setting portal schedule: ' + (err.response?.data?.error || err.message));
        }
      } else if (publishType === 'youtube') {
        // YouTube Schedule
        try {
          setLoading(true);
          const response = await axios.post(`/api/create-videos/${createVideoIdToUse}/youtube-schedule`, {
            total_videos: youtubeTotalVideos,
            videos_per_day: youtubeVideosPerDay,
            times: youtubeTimes
          });
          alert(`✅ YouTube schedule completed!\n\nTotal videos: ${response.data.total}\nSuccessful: ${response.data.successful}\nFailed: ${response.data.failed || 0}`);
        } catch (err) {
          alert('Error scheduling YouTube videos: ' + (err.response?.data?.error || err.message));
        } finally {
          setLoading(false);
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-video-modal">
      <div className="modal-content large-modal">
        <div className="modal-header">
          <h2>{isEditMode ? 'Edit Video' : 'Create Video'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Video Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="My Video 1"
            />
          </div>

          {/* Clips Upload */}
          <div className="form-group">
            <label>Video Clips *</label>
            <div className="upload-section">
              <div className="upload-area" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    id="clips-upload"
                    multiple
                    accept="video/*"
                    onChange={(e) => handleFileUpload('clips', e.target.files)}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="clips-upload" className="upload-btn" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading.clips ? '⏳ Uploading...' : '📁 Upload Clips (Multiple)'}
                  </label>
                  <span className="or-text" style={{ margin: '0 10px' }}>OR</span>
                  <input
                    type="text"
                    name="clips_folder"
                    value={formData.clips_folder}
                    onChange={handleChange}
                    placeholder="Server folder path (e.g., /var/www/autovideo2/data/uploads/...)"
                    className="folder-input"
                    style={{ flex: 1, minWidth: '200px' }}
                    title="Enter server-side folder path, not local Mac path"
                  />
                </div>
                <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                  💡 <strong>Recommended:</strong> Upload button use करें - files automatically server पर save हो जाएंगी।<br/>
                  📁 <strong>Folder Path:</strong> अगर server पर पहले से files हैं, तो server path enter करें (जैसे: <code>/var/www/autovideo2/data/uploads/...</code>)
                </small>
              </div>
              {uploadedClips.length > 0 && (
                <div className="uploaded-files" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                  <strong>✅ Uploaded Files ({uploadedClips.length}):</strong>
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {uploadedClips.map((file, idx) => (
                      <div key={idx} className="file-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <span style={{ fontSize: '12px' }}>{file.filename}</span>
                        <button type="button" onClick={() => handleDeleteFile('clips', file.filename)} className="delete-btn" style={{ padding: '2px 6px', fontSize: '14px' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Audio Upload */}
          <div className="form-group">
            <label>Audio Files *</label>
            <div className="upload-section">
              <div className="upload-area" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    id="audio-upload"
                    multiple
                    accept="audio/*"
                    onChange={(e) => handleFileUpload('audio', e.target.files)}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="audio-upload" className="upload-btn" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading.audio ? '⏳ Uploading...' : '🎵 Upload Audio (Multiple)'}
                  </label>
                  <span className="or-text" style={{ margin: '0 10px' }}>OR</span>
                  <input
                    type="text"
                    name="audio_folder"
                    value={formData.audio_folder}
                    onChange={handleChange}
                    placeholder="Server folder path (e.g., /var/www/autovideo2/data/uploads/...)"
                    className="folder-input"
                    style={{ flex: 1, minWidth: '200px' }}
                    title="Enter server-side folder path, not local Mac path"
                  />
                </div>
                <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                  💡 <strong>Recommended:</strong> Upload button use करें - files automatically server पर save हो जाएंगी।<br/>
                  📁 <strong>Folder Path:</strong> अगर server पर पहले से files हैं, तो server path enter करें (जैसे: <code>/var/www/autovideo2/data/uploads/...</code>)
                </small>
              </div>
              {uploadedAudio.length > 0 && (
                <div className="uploaded-files" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                  <strong>✅ Uploaded Files ({uploadedAudio.length}):</strong>
                  <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {uploadedAudio.map((file, idx) => (
                      <div key={idx} className="file-item" style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 10px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ddd' }}>
                        <span style={{ fontSize: '12px' }}>{file.filename}</span>
                        <button type="button" onClick={() => handleDeleteFile('audio', file.filename)} className="delete-btn" style={{ padding: '2px 6px', fontSize: '14px' }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Thumbnails Upload */}
          <div className="form-group">
            <label>Thumbnails *</label>
            <div className="upload-section">
              <div className="upload-area" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="file"
                    id="thumbnails-upload"
                    multiple
                    accept="image/*"
                    onChange={(e) => handleFileUpload('thumbnails', e.target.files)}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="thumbnails-upload" className="upload-btn" style={{ cursor: 'pointer', margin: 0 }}>
                    {uploading.thumbnails ? '⏳ Uploading...' : '🖼️ Upload Thumbnails (Multiple)'}
                  </label>
                  <span className="or-text" style={{ margin: '0 10px' }}>OR</span>
                  <input
                    type="text"
                    name="thumbnails_folder"
                    value={formData.thumbnails_folder}
                    onChange={handleChange}
                    placeholder="Server folder path (e.g., /var/www/autovideo2/data/uploads/...)"
                    className="folder-input"
                    style={{ flex: 1, minWidth: '200px' }}
                    title="Enter server-side folder path, not local Mac path"
                  />
                </div>
                <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '5px' }}>
                  💡 <strong>Recommended:</strong> Upload button use करें - files automatically server पर save हो जाएंगी।<br/>
                  📁 <strong>Folder Path:</strong> अगर server पर पहले से files हैं, तो server path enter करें (जैसे: <code>/var/www/autovideo2/data/uploads/...</code>)
                </small>
              </div>
              {uploadedThumbnails.length > 0 && (
                <div className="uploaded-files thumbnails-preview" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                  <strong>✅ Uploaded Files ({uploadedThumbnails.length}):</strong>
                  <div className="thumbnails-grid" style={{ marginTop: '10px' }}>
                    {uploadedThumbnails.map((file, idx) => {
                      const cvId = createVideoId || 'temp';
                      const imageUrl = `/uploads/${projectId}/${cvId}/thumbnails/${file.filename}`;
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

          <div className="form-group">
            <label>Tags (comma separated)</label>
            <input
              type="text"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="tag1, tag2, tag3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Publish Time</label>
              <input
                type="time"
                name="publish_time"
                value={formData.publish_time}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label>Videos Per Day</label>
              <input
                type="number"
                name="videos_per_day"
                value={formData.videos_per_day}
                onChange={handleChange}
                min="1"
                max="10"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Start Date</label>
              <input
                type="date"
                name="start_date"
                value={formData.start_date}
                onChange={handleChange}
                placeholder="Auto: Today 7 AM IST"
              />
              <small>Leave empty for auto (Today 7 AM IST)</small>
            </div>

            <div className="form-group">
              <label>End Date</label>
              <input
                type="date"
                name="end_date"
                value={formData.end_date}
                disabled={formData.is_unlimited}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              <input
                type="checkbox"
                name="is_unlimited"
                checked={formData.is_unlimited}
                onChange={handleChange}
              />
              Unlimited (No end date)
            </label>
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
              
              <div className="form-row">
                <div className="form-group">
                  <label>Publish Time (IST) *</label>
                  <input
                    type="time"
                    value={portalTime}
                    onChange={(e) => setPortalTime(e.target.value)}
                    required
                  />
                  <small>Time when videos will be published daily</small>
                </div>

                <div className="form-group">
                  <label>Publish Gap *</label>
                  <select
                    value={portalGap}
                    onChange={(e) => setPortalGap(e.target.value)}
                    required
                  >
                    <option value="daily">Daily</option>
                    <option value="2days">Every 2 days</option>
                    <option value="3days">Every 3 days</option>
                    <option value="4days">Every 4 days</option>
                    <option value="5days">Every 5 days</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Videos Per Day *</label>
                  <input
                    type="number"
                    value={portalVideosPerDay}
                    onChange={(e) => setPortalVideosPerDay(parseInt(e.target.value) || 1)}
                    min="1"
                    max="10"
                    required
                  />
                </div>
              </div>
              
              <div className="info-box" style={{ marginTop: '10px', padding: '10px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
                <strong>ℹ️ Portal Schedule:</strong> Videos will be automatically generated and published at the specified time based on the gap you choose. This runs indefinitely (unlimited).
              </div>
            </div>
          )}

          {/* YouTube Schedule Options */}
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
                  <small>Total number of videos to schedule</small>
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
                <strong>⚠️ YouTube Schedule:</strong> All videos will be generated immediately and uploaded to YouTube with scheduled publish dates. This may take some time depending on the number of videos.
              </div>
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : isEditMode ? 'Update' : publishType === 'save' ? 'Save Draft' : 'Create & Publish'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateVideo;
