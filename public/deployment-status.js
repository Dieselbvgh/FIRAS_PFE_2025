// deployment-status.js - REAL deployment notifications
class DeploymentNotifier {
    constructor() {
        this.notificationContainer = null;
        this.createNotificationContainer();
        this.checkDeploymentStatus();
        
        // Check every 30 seconds
        setInterval(() => this.checkDeploymentStatus(), 30000);
    }
    
    createNotificationContainer() {
        // Remove existing notification if any
        const existing = document.getElementById('real-deployment-notification');
        if (existing) existing.remove();
        
        // Create new notification container
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.id = 'real-deployment-notification';
        this.notificationContainer.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #27ae60;
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
            transition: all 0.3s ease;
            display: none;
        `;
        
        document.body.appendChild(this.notificationContainer);
    }
    
    async checkDeploymentStatus() {
        try {
            const response = await fetch('/api/deployment/status');
            if (response.ok) {
                const data = await response.json();
                
                if (data.latest && data.latest.real) {
                    this.showRealNotification(data.latest);
                } else {
                    this.hideNotification();
                }
            }
        } catch (error) {
            console.log('Deployment status check failed:', error);
        }
    }
    
    showRealNotification(deployment) {
        const timeAgo = this.getTimeAgo(deployment.timestamp);
        
        this.notificationContainer.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">
                🚀 DEPLOYED v${deployment.version}
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
                Commit: ${deployment.commit}<br>
                ${timeAgo}
            </div>
            <div style="position: absolute; top: 8px; right: 8px; cursor: pointer;" 
                 onclick="deploymentNotifier.hideNotification()">✕</div>
        `;
        
        this.notificationContainer.style.display = 'block';
        this.notificationContainer.style.background = '#27ae60';
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            this.hideNotification();
        }, 10000);
    }
    
    showDeployingNotification() {
        this.notificationContainer.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">
                ⚡ DEPLOYING...
            </div>
            <div style="font-size: 12px; opacity: 0.9;">
                New version is being deployed
            </div>
        `;
        
        this.notificationContainer.style.display = 'block';
        this.notificationContainer.style.background = '#e67e22';
    }
    
    hideNotification() {
        if (this.notificationContainer) {
            this.notificationContainer.style.display = 'none';
        }
    }
    
    getTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const diff = now - then;
        
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${days}d ago`;
    }
}

// Initialize when page loads
let deploymentNotifier;
document.addEventListener('DOMContentLoaded', function() {
    deploymentNotifier = new DeploymentNotifier();
    
    // Simulate deployment for demo (remove in production)
    setTimeout(() => {
        deploymentNotifier.showRealNotification({
            version: '2.0.0',
            commit: 'a1b2c3d',
            timestamp: new Date().toISOString(),
            real: true
        });
    }, 2000);
});

// Global function to manually trigger deployment notification
window.showDeploymentNotification = function(version, commit) {
    if (deploymentNotifier) {
        deploymentNotifier.showRealNotification({
            version: version || '1.0.0',
            commit: commit || 'unknown',
            timestamp: new Date().toISOString(),
            real: true
        });
    }
};
