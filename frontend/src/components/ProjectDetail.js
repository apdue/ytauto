import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import './ProjectDetail.css';

function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [videos, setVideos] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [authUrl, setAuthUrl] = useState(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchProject();
    fetchVideos();
    fetchLogs();
    fetchAuthUrl();
    const interval = setInterval(() => {
      fetchProject();
      fetchVideos();
      fetchLogs();
    }, 5000);
    return () => clearInterval(interval);
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

  const fetchVideos = async () => {
    try {
      const response = await axios.get(`/api/videos/project/${id}`);
      setVideos(response.data);
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  };

  const fetchLogs = async () => {
    try {
      const response = await axios.get(`/api/logs/project/${id}?limit=50`);
      setLogs(response.data);
    } catch (error) {
      console.error('Error fetching logs:', error);
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

  const handleYouTubeAuth = () => {
    if (authUrl) {
      const authWindow = window.open(authUrl, '_blank', 'width=600,height=700');
      
      // Poll for auth completion
      const pollInterval = setInterval(async () => {
        try {
          // Check if window was closed (user might have completed auth)
          if (authWindow.closed) {
            clearInterval(pollInterval);
            // Wait a moment for backend to process, then check
            setTimeout(async () => {
              await fetchProject();
              if (project && project.youtube_channel_id) {
                alert('YouTube account linked successfully!');
              }
            }, 1000);
            return;
          }
          
          const response = await axios.get(`/api/projects/${id}`);
          if (response.data.youtube_channel_id) {
            clearInterval(pollInterval);
            authWindow.close();
            fetchProject();
            alert('YouTube account linked successfully!');
          }
        } catch (error) {
          // Continue polling
        }
      }, 2000);

      // Stop polling after 5 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
        if (!authWindow.closed) {
          authWindow.close();
        }
      }, 300000);
    }
  };

  const handleGenerateVideo = async () => {
    if (!window.confirm('Generate a video now? This will add it to the queue.')) {
      return;
    }
    setGenerating(true);
    try {
      await axios.post(`/api/queue/generate/${id}`, { count: 1 });
      alert('Video added to queue!');
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setGenerating(false);
    }
  };

  const handleInstantPublish = async () => {
    if (!project.refresh_token) {
      alert('Please link your YouTube account first!');
      return;
    }
    if (!window.confirm('Generate and publish video immediately? This will create a video and publish it as PUBLIC on YouTube right now.')) {
      return;
    }
    setGenerating(true);
    try {
      const response = await axios.post(`/api/videos/instant-publish/${id}`);
      alert(`✅ Video published successfully!\n\nTitle: ${response.data.video.title}\nURL: ${response.data.video.url}\n\nYou can view it on YouTube now!`);
      fetchVideos();
      fetchProject();
    } catch (error) {
      alert('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setGenerating(false);
    }
  };

  const updateProject = async (updates) => {
    try {
      await axios.put(`/api/projects/${id}`, updates);
      fetchProject();
    } catch (error) {
      alert('Error updating project: ' + error.message);
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
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleGenerateVideo}
              disabled={generating || !project.refresh_token}
            >
              {generating ? 'Generating...' : 'Generate Video Now'}
            </button>
            <button 
              className="btn btn-success" 
              onClick={handleInstantPublish}
              disabled={generating || !project.refresh_token}
              title={!project.refresh_token ? 'Link YouTube account first' : 'Generate and publish video immediately as PUBLIC'}
            >
              {generating ? 'Publishing...' : '⚡ Instant Publish'}
            </button>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button 
          className={activeTab === 'overview' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={activeTab === 'videos' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('videos')}
        >
          Videos ({videos.length})
        </button>
        <button 
          className={activeTab === 'logs' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('logs')}
        >
          Logs
        </button>
        <button 
          className={activeTab === 'settings' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{project.stats?.clipsCount || 0}</h3>
              <p>Clips Available</p>
            </div>
            <div className="stat-card">
              <h3>{project.stats?.audioCount || 0}</h3>
              <p>Audio Files</p>
            </div>
            <div className="stat-card">
              <h3>{project.stats?.thumbnailsCount || 0}</h3>
              <p>Thumbnails</p>
            </div>
            <div className="stat-card">
              <h3>{project.stats?.totalVideos || 0}</h3>
              <p>Total Videos</p>
            </div>
            <div className="stat-card">
              <h3>{project.stats?.uploadedVideos || 0}</h3>
              <p>Uploaded</p>
            </div>
          </div>

          <div className="card">
            <h3>Project Information</h3>
            <div className="info-grid">
              <div>
                <strong>YouTube Channel:</strong>
                <p>{project.youtube_channel_name || 'Not linked'}</p>
                {!project.refresh_token && (
                  <button className="btn btn-primary" onClick={handleYouTubeAuth}>
                    Link YouTube Account
                  </button>
                )}
              </div>
              <div>
                <strong>Videos Per Day:</strong>
                <p>{project.videos_per_day}</p>
              </div>
              <div>
                <strong>Upload Time:</strong>
                <p>{project.upload_time}</p>
              </div>
              <div>
                <strong>Date Range:</strong>
                <p>{new Date(project.start_date).toLocaleDateString()} - {new Date(project.end_date).toLocaleDateString()}</p>
              </div>
              <div>
                <strong>Status:</strong>
                <p>
                  <span className={`badge ${project.is_active ? 'badge-success' : 'badge-warning'}`}>
                    {project.is_active ? 'Active' : 'Inactive'}
                  </span>
                </p>
                <button 
                  className="btn btn-secondary"
                  onClick={() => updateProject({ is_active: project.is_active ? 0 : 1 })}
                >
                  {project.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'videos' && (
        <div className="tab-content">
          <div className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Scheduled Date</th>
                  <th>Uploaded At</th>
                  <th>YouTube ID</th>
                </tr>
              </thead>
              <tbody>
                {videos.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign: 'center' }}>No videos yet</td>
                  </tr>
                ) : (
                  videos.map(video => (
                    <tr key={video.id}>
                      <td>{video.title}</td>
                      <td>
                        <span className={`badge ${
                          video.status === 'uploaded' ? 'badge-success' :
                          video.status === 'generated' ? 'badge-info' :
                          'badge-warning'
                        }`}>
                          {video.status}
                        </span>
                      </td>
                      <td>{video.scheduled_date ? new Date(video.scheduled_date).toLocaleString() : '-'}</td>
                      <td>{video.uploaded_at ? new Date(video.uploaded_at).toLocaleString() : '-'}</td>
                      <td>
                        {video.youtube_video_id ? (
                          <a 
                            href={`https://www.youtube.com/watch?v=${video.youtube_video_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {video.youtube_video_id}
                          </a>
                        ) : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="tab-content">
          <div className="card">
            <div className="logs-container">
              {logs.length === 0 ? (
                <p>No logs yet</p>
              ) : (
                logs.map(log => (
                  <div key={log.id} className={`log-entry log-${log.type}`}>
                    <div className="log-header">
                      <span className={`badge ${
                        log.type === 'success' ? 'badge-success' :
                        log.type === 'error' ? 'badge-danger' :
                        'badge-info'
                      }`}>
                        {log.type}
                      </span>
                      <span className="log-time">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div className="log-message">{log.message}</div>
                    {log.error && <div className="log-error">{log.error}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="tab-content">
          <div className="card">
            <h3>Edit Project Settings</h3>
            <ProjectSettingsForm project={project} onUpdate={updateProject} />
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectSettingsForm({ project, onUpdate }) {
  const [formData, setFormData] = useState({
    videos_per_day: project.videos_per_day,
    upload_time: project.upload_time,
    title_template: project.title_template,
    description_template: project.description_template,
    tags: project.tags || ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onUpdate(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
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

      <div className="form-group">
        <label>Upload Time</label>
        <input
          type="time"
          name="upload_time"
          value={formData.upload_time}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label>Title Template</label>
        <input
          type="text"
          name="title_template"
          value={formData.title_template}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label>Description Template</label>
        <textarea
          name="description_template"
          value={formData.description_template}
          onChange={handleChange}
        />
      </div>

      <div className="form-group">
        <label>Tags</label>
        <input
          type="text"
          name="tags"
          value={formData.tags}
          onChange={handleChange}
        />
      </div>

      <button type="submit" className="btn btn-primary">Update Settings</button>
    </form>
  );
}

export default ProjectDetail;

