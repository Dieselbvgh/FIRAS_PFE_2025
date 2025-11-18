// deployment-status.js - REAL Deployment Messages
class RealDeploymentNotifier {
    constructor() {
        this.notification = null;
        this.createNotification();
        this.checkDeployment();
        
        // Check every 20 seconds
        setInterval(() => this.checkDeployment(), 20000);
    }
    
    createNotification() {
        // Remove existing
        const existing = document.getElementById('real-deploy-notification');
        if (existing) existing.remove();
        
        // Create new notification
        this.notification = document.createElement('div');
        this.notification.id = 'real-deploy-notification';
        this.notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 280px;
            border-left: 5px solid #4CAF50;
            animation: slideIn 0.5s ease-out;
            cursor: pointer;
        `;
        
        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(300px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes pulse {
                0% { transform: scale(1); }
                50% { transform: scale(1.05); }
                100% { transform: scale(1); }
            }
            .pulse { animation: pulse 2s infinite; }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(this.notification);
    }
    
    async checkDeployment() {
        try {
            const response = await fetch('/api/deployment/status');
            if (response.ok) {
                const data = await response.json();
                
                if (data.latest && data.latest.real) {
                    this.showDeploymentSuccess(data.latest);
                } else {
                    this.showReadyMessage();
                }
            }
        } catch (error) {
            this.showOfflineMessage();
        }
    }
    
    showDeploymentSuccess(deployment) {
        const timeAgo = this.getTimeAgo(deployment.timestamp);
        const commitShort = deployment.commit ? deployment.commit.substring(0, 7) : 'unknown';
        
        this.notification.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 18px; margin-right: 8px;">🚀</span>
                <strong style="flex: 1;">DEPLOYMENT SUCCESS!</strong>
                <span style="cursor: pointer; font-weight: bold;" onclick="this.parentElement.parentElement.remove()">✕</span>
            </div>
            <div style="font-size: 12px; line-height: 1.4;">
                <div>Version: <strong>v${deployment.version}</strong></div>
                <div>Commit: <code>${commitShort}</code></div>
                <div>Deployed: ${timeAgo}</div>
            </div>
        `;
        
        this.notification.style.background = 'linear-gradient(135deg, #4CAF50 0%, #45a049 100%)';
        this.notification.classList.add('pulse');
        
        // Auto-hide after 15 seconds
        setTimeout(() => {
            if (this.notification && this.notification.parentElement) {
                this.notification.remove();
            }
        }, 15000);
    }
    
    showReadyMessage() {
        this.notification.innerHTML = `
            <div style="display: flex; align-items: center;">
                <span style="font-size: 16px; margin-right: 8px;">✅</span>
                <strong>CI/CD READY</strong>
            </div>
            <div style="font-size: 11px; margin-top: 5px; opacity: 0.9;">
                System is live and waiting for deployments
            </div>
        `;
        
        this.notification.style.background = 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)';
        this.notification.classList.remove('pulse');
    }
    
    showOfflineMessage() {
        this.notification.innerHTML = `
            <div style="display: flex; align-items: center;">
                <span style="font-size: 16px; margin-right: 8px;">🔧</span>
                <strong>SETUP MODE</strong>
            </div>
            <div style="font-size: 11px; margin-top: 5px; opacity: 0.9;">
                Configuring deployment tracking...
            </div>
        `;
        
        this.notification.style.background = 'linear-gradient(135deg, #FF9800 0%, #FF5722 100%)';
        this.notification.classList.remove('pulse');
    }
    
    getTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = now - then;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return 'Today';
    }
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    new RealDeploymentNotifier();
});

// Manual trigger for testing (remove in production)
window.testDeployment = function() {
    const notifier = new RealDeploymentNotifier();
    notifier.showDeploymentSuccess({
        version: '2.0.0',
        commit: 'a1b2c3d',
        timestamp: new Date().toISOString(),
        real: true
    });
};
