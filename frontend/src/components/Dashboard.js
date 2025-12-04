import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Dashboard.css';

function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [queueStats, setQueueStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    fetchQueueStats();
    const interval = setInterval(() => {
      fetchProjects();
      fetchQueueStats();
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get('/api/projects');
      setProjects(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setLoading(false);
    }
  };

  const fetchQueueStats = async () => {
    try {
      const response = await axios.get('/api/queue/stats');
      setQueueStats(response.data);
    } catch (error) {
      console.error('Error fetching queue stats:', error);
    }
  };

  const deleteProject = async (id) => {
    if (!window.confirm('Are you sure you want to delete this project?')) {
      return;
    }
    try {
      await axios.delete(`/api/projects/${id}`);
      fetchProjects();
    } catch (error) {
      alert('Error deleting project: ' + error.message);
    }
  };

  if (loading) {
    return <div className="loading">Loading projects...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>Projects Dashboard</h2>
        <button className="btn btn-primary" onClick={() => navigate('/create')}>
          + Create New Project
        </button>
      </div>

      {queueStats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>{queueStats.pending || 0}</h3>
            <p>Pending Videos</p>
          </div>
          <div className="stat-card">
            <h3>{queueStats.processing || 0}</h3>
            <p>Processing</p>
          </div>
          <div className="stat-card">
            <h3>{queueStats.completed || 0}</h3>
            <p>Completed</p>
          </div>
          <div className="stat-card">
            <h3>{queueStats.failed || 0}</h3>
            <p>Failed</p>
          </div>
        </div>
      )}

      {projects.length === 0 ? (
        <div className="card">
          <p>No projects yet. Create your first project to get started!</p>
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map(project => (
            <div key={project.id} className="project-card">
              <div className="project-header">
                <h3>{project.name}</h3>
                <span className={`badge ${project.is_active ? 'badge-success' : 'badge-warning'}`}>
                  {project.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="project-info">
                <p><strong>YouTube Channel:</strong> {project.youtube_channel_name || 'Not linked'}</p>
                <p><strong>Videos per day:</strong> {project.videos_per_day}</p>
                <p><strong>Upload time:</strong> {project.upload_time}</p>
                <p><strong>Date range:</strong> {new Date(project.start_date).toLocaleDateString()} - {new Date(project.end_date).toLocaleDateString()}</p>
              </div>

              <div className="project-actions">
                <button 
                  className="btn btn-primary" 
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  View Details
                </button>
                <button 
                  className="btn btn-danger" 
                  onClick={() => deleteProject(project.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;

