import React from 'react';
import './ProgressModal.css';

function ProgressModal({ isOpen, progress, currentStep, message, onClose }) {
  if (!isOpen) return null;

  const steps = [
    { id: 'generating', label: 'Generating Video', icon: '🎬' },
    { id: 'uploading', label: 'Uploading to YouTube', icon: '📤' },
    { id: 'processing', label: 'Processing', icon: '⚙️' },
    { id: 'complete', label: 'Complete!', icon: '✅' }
  ];

  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className="progress-modal-overlay">
      <div className="progress-modal">
        <div className="progress-header">
          <h2>Publishing Video</h2>
          {progress === 100 && (
            <button className="close-btn" onClick={onClose}>×</button>
          )}
        </div>

        <div className="progress-content">
          <div className="progress-steps">
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.id} className={`progress-step ${isCompleted ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}>
                  <div className="step-icon">
                    {isCompleted ? '✅' : isCurrent ? step.icon : '⏳'}
                  </div>
                  <div className="step-label">{step.label}</div>
                  {isCurrent && (
                    <div className="step-spinner">
                      <div className="spinner"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>

          <div className="progress-message">
            {message || 'Processing...'}
          </div>

          {progress === 100 && (
            <div className="progress-complete">
              <div className="success-icon">🎉</div>
              <p>Video published successfully!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProgressModal;

