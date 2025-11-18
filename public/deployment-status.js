document.addEventListener('DOMContentLoaded', function() {
  const badge = document.createElement('div');
  badge.innerHTML = `
    <div style="
      position: fixed;
      top: 15px;
      right: 15px;
      background: linear-gradient(45deg, #27ae60, #2ecc71);
      color: white;
      padding: 12px 20px;
      border-radius: 25px;
      font-size: 16px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
      border: 2px solid white;
      animation: pulse 2s infinite;
    ">
      🚀 AUTO-DEPLOYED<br>
      <small>Port 5001 Fixed</small>
    </div>
    <style>
      @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
    </style>
  `;
  document.body.appendChild(badge);
});
