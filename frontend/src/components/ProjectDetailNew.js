import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import CreateVideo from './CreateVideo';
import BulkSchedule from './BulkSchedule';
import LongVideo from './LongVideo';
import ProgressModal from './ProgressModal';
import './ProjectDetail.css';

function ProjectDetailNew() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [createVideos, setCreateVideos] = useState([]);
  const [longVideos, setLongVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('create-videos');
  const [authUrl, setAuthUrl] = useState(null);
  const [showCreateVideoModal, setShowCreateVideoModal] = useState(false);
  const [showBulkScheduleModal, setShowBulkScheduleModal] = useState(false);
  const [showLongVideoModal, setShowLongVideoModal] = useState(false);
  const [selectedCreateVideoId, setSelectedCreateVideoId] = useState(null);
  const [editingCreateVideoId, setEditingCreateVideoId] = useState(null);
  const [editingLongVideoId, setEditingLongVideoId] = useState(null);
  const [showProgress, setShowProgress] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('generating');
  const [progressMessage, setProgressMessage] = useState('');
  const [linkingYouTube, setLinkingYouTube] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchCreateVideos();
    fetchLongVideos();
    fetchAuthUrl();
    const interval = setInterval(() => {
      fetchProject();
      fetchCreateVideos();
      fetchLongVideos();
    }, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProject = async () => {
    try {
      const response = await axios.get(`/api/projects/${id}`);
      setProject(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching project:', error);
      setLoading(false);
    }
  };

  const fetchCreateVideos = async () => {
    try {
      const response = await axios.get(`/api/create-videos/project/${id}`);
      setCreateVideos(response.data);
    } catch (error) {
      console.error('Error fetching create videos:', error);
    }
  };

  const fetchLongVideos = async () => {
    try {
      const response = await axios.get(`/api/long-videos/project/${id}`);
      setLongVideos(response.data);
    } catch (error) {
      console.error('Error fetching long videos:', error);
    }
  };

  const fetchAuthUrl = async () => {
    try {
      const response = await axios.get(`/api/youtube/auth-url/${id}`);
      setAuthUrl(response.data.authUrl);
    } catch (error) {
      console.error('Error fetching auth URL:', error);
    }
  };

  const handleYouTubeAuth = async () => {
    if (linkingYouTube) return; // Prevent multiple clicks
    
    setLinkingYouTube(true);
    try {
      // If authUrl is not available, try to fetch it first
      let urlToUse = authUrl;
      if (!urlToUse) {
        try {
          const response = await axios.get(`/api/youtube/auth-url/${id}`);
          if (response.data.error) {
            alert(`Error: ${response.data.error}\n\nPlease configure YouTube OAuth credentials in your backend environment variables:\n- GOOGLE_CLIENT_ID\n- GOOGLE_CLIENT_SECRET\n- REDIRECT_URI`);
            setLinkingYouTube(false);
            return;
          }
          urlToUse = response.data.authUrl;
          setAuthUrl(urlToUse);
        } catch (error) {
          const errorMsg = error.response?.data?.error || error.message;
          alert(`Error: Could not get YouTube authentication URL.\n\n${errorMsg}\n\nPlease check:\n1. Backend is running\n2. YouTube OAuth is configured in environment variables`);
          console.error('Error fetching auth URL:', error);
          setLinkingYouTube(false);
          return;
        }
      }

      if (!urlToUse) {
        alert('Error: YouTube authentication URL is not available. Please check your configuration.');
        setLinkingYouTube(false);
        return;
      }

      // Open the authentication window
      const authWindow = window.open(urlToUse, '_blank', 'width=600,height=700');
      
      if (!authWindow) {
        alert('Error: Popup blocked. Please allow popups for this site and try again.');
        setLinkingYouTube(false);
        return;
      }

      // Poll for auth completion
      const pollInterval = setInterval(async () => {
        try {
          // Check if window was closed (user might have completed auth)
          if (authWindow.closed) {
            clearInterval(pollInterval);
            setLinkingYouTube(false);
            // Wait a moment for backend to process, then check
            setTimeout(async () => {
              await fetchProject();
              try {
                const updatedProject = await axios.get(`/api/projects/${id}`);
                if (updatedProject.data.youtube_channel_id) {
                  alert('YouTube account linked successfully!');
                }
              } catch (err) {
                console.error('Error checking project after auth:', err);
              }
            }, 1000);
            return;
          }
          
          const response = await axios.get(`/api/projects/${id}`);
          if (response.data.youtube_channel_id) {
            clearInterval(pollInterval);
            authWindow.close();
            setLinkingYouTube(false);
            await fetchProject();
            alert('YouTube account linked successfully!');
          }
        } catch (error) {
          // Continue polling
          console.error('Polling error:', error);
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        setLinkingYouTube(false);
        if (authWindow && !authWindow.closed) {
          authWindow.close();
        }
      }, 300000);
    } catch (error) {
      setLinkingYouTube(false);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`Error: ${errorMsg}`);
      console.error('YouTube auth error:', error);
    }
  };

  const handleInstantPublish = async (createVideoId) => {
    if (!project.refresh_token) {
      alert('Please link your YouTube account first!');
      return;
    }
    if (!window.confirm('Generate and publish this video immediately as PUBLIC?')) {
      return;
    }

    // Show progress modal
    setShowProgress(true);
    setProgress(0);
    setCurrentStep('generating');
    setProgressMessage('Preparing to generate video...');

    // Progress simulation function
    const updateProgress = (targetProgress, message, delay = 300) => {
      return new Promise((resolve) => {
        setProgress(prev => {
          const currentProgress = prev;
          const steps = 10;
          const increment = (targetProgress - currentProgress) / steps;
          let step = 0;

          const interval = setInterval(() => {
            step++;
            setProgress(prevProgress => {
              const newProgress = Math.min(prevProgress + increment, targetProgress);
              if (message && step === 1) setProgressMessage(message);
              return Math.floor(newProgress);
            });
            
            if (step >= steps) {
              clearInterval(interval);
              resolve();
            }
          }, delay / steps);
          
          return currentProgress;
        });
        // Small delay to ensure state update
        setTimeout(() => resolve(), delay);
      });
    };

    try {
      // Step 1: Selecting clips and audio (0-15%)
      setProgressMessage('Selecting clips and audio files...');
      for (let i = 0; i <= 15; i++) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      
      // Step 2: Analyzing media (15-25%)
      setProgressMessage('Analyzing video clips and audio duration...');
      for (let i = 15; i <= 25; i++) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
      // Step 3: Generating video (25-60%)
      setProgressMessage('Generating video with FFmpeg (this may take a minute)...');
      for (let i = 25; i <= 60; i++) {
        setProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Switch to uploading step
      setCurrentStep('uploading');
      setProgressMessage('Video generated successfully! Starting upload to YouTube...');
      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(65);

      // Make the actual API call
      const startTime = Date.now();
      
      // Start upload progress simulation
      const uploadInterval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const estimatedTotal = 30000; // Estimate 30 seconds for upload
        const uploadProgress = Math.min(65 + Math.floor((elapsed / estimatedTotal) * 30), 95);
        setProgress(uploadProgress);
        const percent = Math.min(Math.floor((elapsed / estimatedTotal) * 100), 100);
        setProgressMessage(`Uploading to YouTube... ${percent}%`);
      }, 500);

      // Make API call
      const response = await axios.post(`/api/create-videos/${createVideoId}/instant-publish`);

      clearInterval(uploadInterval);
      setProgress(95);
      setProgressMessage('Finalizing upload...');
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Complete
      setCurrentStep('complete');
      setProgress(100);
      setProgressMessage(`Video published successfully!`);

      // Wait a bit to show success, then close
      setTimeout(() => {
        setShowProgress(false);
        alert(`✅ Video published successfully!\n\nURL: ${response.data.url}`);
        fetchCreateVideos();
        // Reset progress
        setProgress(0);
        setCurrentStep('generating');
        setProgressMessage('');
      }, 2500);

    } catch (error) {
      setShowProgress(false);
      alert('Error: ' + (error.response?.data?.error || error.message));
      // Reset progress
      setProgress(0);
      setCurrentStep('generating');
      setProgressMessage('');
    }
  };

  const handleBulkSchedule = (createVideoId) => {
    setSelectedCreateVideoId(createVideoId);
    setShowBulkScheduleModal(true);
  };

  const handleUnlinkYouTube = async () => {
    if (!window.confirm('Are you sure you want to unlink this YouTube channel? You will need to re-authenticate to upload videos.')) {
      return;
    }

    try {
      await axios.post(`/api/youtube/unlink/${id}`);
      alert('YouTube channel unlinked successfully!');
      fetchProject();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteCreateVideo = async (createVideoId, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/create-videos/${createVideoId}`);
      alert('Create Video deleted successfully!');
      fetchCreateVideos();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleDeleteLongVideo = async (longVideoId, name) => {
    if (!window.confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`/api/long-videos/${longVideoId}`);
      alert('Long Video deleted successfully!');
      fetchLongVideos();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return <div className="loading">Loading project...</div>;
  }

  if (!project) {
    return <div className="error">Project not found</div>;
  }

  return (
    <div className="project-detail">
      <div className="page-header">
        <div>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            ← Back to Dashboard
          </button>
          <h2>{project.name}</h2>
        </div>
        <div className="header-actions">
          {!project.refresh_token ? (
            <button 
              className="btn btn-primary" 
              onClick={handleYouTubeAuth}
              disabled={linkingYouTube}
            >
              {linkingYouTube ? 'Linking...' : 'Link YouTube Account'}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div style={{ marginRight: '10px' }}>
                <strong>YouTube:</strong> {project.youtube_channel_name || 'Linked'}
              </div>
              <button className="btn btn-danger" onClick={handleUnlinkYouTube}>
                Unlink YouTube
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="tabs">
        <button 
          className={activeTab === 'create-videos' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('create-videos')}
        >
          Create Videos ({createVideos.length})
        </button>
        <button 
          className={activeTab === 'long-videos' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('long-videos')}
        >
          Long Videos ({longVideos.length})
        </button>
      </div>

      {activeTab === 'create-videos' && (
        <div className="tab-content">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Create Videos</h3>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setEditingCreateVideoId(null);
                  setShowCreateVideoModal(true);
                }}
              >
                + Create Video
              </button>
            </div>

            {createVideos.length === 0 ? (
              <p>No create videos yet. Click "Create Video" to get started.</p>
            ) : (
              <div className="create-videos-list">
                {createVideos.map(cv => (
                  <div key={cv.id} className="create-video-card">
                    <div className="card-header">
                      <h4>{cv.name}</h4>
                      <span className={`badge ${
                        cv.status === 'published' ? 'badge-success' :
                        cv.status === 'scheduled' ? 'badge-info' :
                        'badge-warning'
                      }`}>
                        {cv.status}
                      </span>
                    </div>
                    <div className="card-body">
                      <p><strong>Title:</strong> {cv.title}</p>
                      <p><strong>Publish Time:</strong> {cv.publish_time}</p>
                      <p><strong>Videos Per Day:</strong> {cv.videos_per_day}</p>
                      {cv.start_date && (
                        <p><strong>Start Date:</strong> {new Date(cv.start_date).toLocaleDateString()}</p>
                      )}
                      {cv.end_date && (
                        <p><strong>End Date:</strong> {new Date(cv.end_date).toLocaleDateString()}</p>
                      )}
                      {cv.is_unlimited && <p><strong>Unlimited:</strong> Yes</p>}
                    </div>
                    <div className="card-actions">
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setEditingCreateVideoId(cv.id);
                          setShowCreateVideoModal(true);
                        }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => handleInstantPublish(cv.id)}
                        disabled={!project.refresh_token}
                      >
                        ⚡ Instant Publish
                      </button>
                      <button
                        className="btn btn-info btn-sm"
                        onClick={() => handleBulkSchedule(cv.id)}
                        disabled={!project.refresh_token}
                      >
                        📅 Bulk Schedule
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteCreateVideo(cv.id, cv.name)}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'long-videos' && (
        <div className="tab-content">
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Long Videos</h3>
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setEditingLongVideoId(null);
                  setShowLongVideoModal(true);
                }}
              >
                + Create Long Video
              </button>
            </div>

            {longVideos.length === 0 ? (
              <p>No long videos yet. Create a long video by merging multiple Create Videos.</p>
            ) : (
              <div className="long-videos-list">
                {longVideos.map(lv => {
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
                  
                  const titles = parseSafe(lv.title);
                  const sequence = parseSafe(lv.create_video_sequence);
                  return (
                    <div key={lv.id} className="long-video-card">
                      <div className="card-header">
                        <h4>{lv.name}</h4>
                        <span className={`badge ${
                          lv.status === 'published' ? 'badge-success' :
                          lv.status === 'scheduled' ? 'badge-info' :
                          'badge-warning'
                        }`}>
                          {lv.status}
                        </span>
                      </div>
                      <div className="card-body">
                        <p><strong>Titles:</strong> {titles.length} title(s)</p>
                        <p><strong>Sequence:</strong> {sequence.length} videos</p>
                        {lv.youtube_video_id && (
                          <p>
                            <a href={`https://www.youtube.com/watch?v=${lv.youtube_video_id}`} target="_blank" rel="noopener noreferrer">
                              View on YouTube
                            </a>
                          </p>
                        )}
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            setEditingLongVideoId(lv.id);
                            setShowLongVideoModal(true);
                          }}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeleteLongVideo(lv.id, lv.name)}
                        >
                          🗑️ Delete
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

      {showCreateVideoModal && (
        <CreateVideo
          projectId={id}
          createVideoId={editingCreateVideoId}
          onClose={() => {
            setShowCreateVideoModal(false);
            setEditingCreateVideoId(null);
          }}
          onSuccess={() => {
            fetchCreateVideos();
            setShowCreateVideoModal(false);
            setEditingCreateVideoId(null);
          }}
        />
      )}

      {showBulkScheduleModal && (
        <BulkSchedule
          projectId={id}
          createVideoId={selectedCreateVideoId}
          onClose={() => {
            setShowBulkScheduleModal(false);
            setSelectedCreateVideoId(null);
          }}
          onSuccess={() => {
            fetchCreateVideos();
            setShowBulkScheduleModal(false);
          }}
        />
      )}

      {showLongVideoModal && (
        <LongVideo
          projectId={id}
          longVideoId={editingLongVideoId}
          onClose={() => {
            setShowLongVideoModal(false);
            setEditingLongVideoId(null);
          }}
          onSuccess={() => {
            fetchLongVideos();
            setShowLongVideoModal(false);
            setEditingLongVideoId(null);
          }}
        />
      )}

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
  );
}

export default ProjectDetailNew;

