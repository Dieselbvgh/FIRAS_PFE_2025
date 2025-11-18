document.addEventListener('DOMContentLoaded', function() {
    const badge = document.createElement('div');
    badge.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(45deg, #3498db, #2980b9);
            color: white;
            padding: 15px 25px;
            border-radius: 30px;
            font-size: 16px;
            font-weight: bold;
            z-index: 10000;
            box-shadow: 0 6px 20px rgba(0,0,0,0.3);
            border: 3px solid white;
            text-align: center;
        ">
            🌐 Webhook Deploy<br>
            <small style="font-size: 12px;">CI/CD Active</small>
        </div>
    `;
    document.body.appendChild(badge);
});
