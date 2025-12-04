import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './CreateProject.css';

function CreateProject() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/projects', formData);
      setSuccess('Project created successfully!');
      setTimeout(() => {
        navigate('/');
      }, 1500);
    } catch (error) {
      console.error('Project creation error:', error);
      
      let errorMessage = 'Error creating project';
      
      if (error.response) {
        errorMessage = error.response.data?.error || `Server error: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = 'Cannot connect to server. Please check:\n1. Backend is running on port 5001\n2. No firewall blocking the connection\n3. Try refreshing the page';
      } else {
        errorMessage = error.message || 'Network error occurred';
      }
      
      setError(errorMessage);
    }
  };

  return (
    <div className="create-project">
      <div className="page-header">
        <h2>Create New Project</h2>
        <button className="btn btn-secondary" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>
      </div>

      <div className="card">
        {error && (
          <div className="error">
            <strong>Error:</strong> {error}
            {error.includes('\n') && (
              <pre style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>{error}</pre>
            )}
          </div>
        )}
        {success && <div className="success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Project Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              placeholder="My Video Project"
            />
            <small>This is just a container. You'll add Create Videos inside this project.</small>
          </div>

          <div className="info-box">
            <h4>📝 What's Next?</h4>
            <p>After creating the project:</p>
            <ul>
              <li>Link your YouTube account</li>
              <li>Create Videos with clips, audio, thumbnails, titles, etc.</li>
              <li>Create Long Videos by merging multiple Create Videos</li>
              <li>Schedule or publish videos</li>
            </ul>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Create Project
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateProject;
