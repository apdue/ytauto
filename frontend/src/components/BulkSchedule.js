import React, { useState } from 'react';
import axios from 'axios';
import './BulkSchedule.css';

function BulkSchedule({ projectId, createVideoId, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    number_of_videos: 10,
    start_date: '',
    publish_time: '07:00',
    schedule_type: 'youtube' // 'portal' or 'youtube'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('/api/bulk-schedule', {
        project_id: projectId,
        create_video_id: createVideoId,
        ...formData
      });

      alert(`Successfully scheduled ${formData.number_of_videos} videos!`);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bulk-schedule-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Bulk Schedule Videos</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Number of Videos *</label>
            <input
              type="number"
              name="number_of_videos"
              value={formData.number_of_videos}
              onChange={handleChange}
              required
              min="1"
              max="100"
            />
            <small>Videos will be scheduled starting from tomorrow at 7 AM IST</small>
          </div>

          <div className="form-group">
            <label>Start Date *</label>
            <input
              type="date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Publish Time</label>
            <input
              type="time"
              name="publish_time"
              value={formData.publish_time}
              onChange={handleChange}
            />
            <small>Default: 7:00 AM IST</small>
          </div>

          <div className="form-group">
            <label>Schedule Type *</label>
            <select
              name="schedule_type"
              value={formData.schedule_type}
              onChange={handleChange}
              required
            >
              <option value="portal">Portal Schedule (Portal will publish at fixed time)</option>
              <option value="youtube">YouTube Schedule (YouTube will schedule automatically)</option>
            </select>
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Scheduling...' : 'Schedule Videos'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default BulkSchedule;

