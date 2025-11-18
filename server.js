/**
 * server.js - DevSecOps Dashboard backend
 * - Runs trivy & grype scans
 * - VAN host checks (ddos, cpu, disk, apt stamp, firewall)
 * - DevSecOps auto-fix (real only if ENABLE_REAL_FIX=true)
 * - Alerts store with mitigation endpoint
 * - Chat endpoint (rule-based)
 * only after you review and accept the mitigation steps.
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const PORT = Number(process.env.PORT || 5001);
const ENABLE_REAL_FIX = (process.env.ENABLE_REAL_FIX === 'true');
const DATA_DIR = path.join(__dirname, 'data');
const LOGS_DIR = path.join(__dirname, 'logs');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const TRIVY_PATH = path.join('/tmp','trivy_reports','trivy-last.json');
const GRYPE_PATH = path.join('/tmp','grype_reports','grype-last.json');

try { fs.mkdirSync(path.dirname(TRIVY_PATH), { recursive: true }); } catch(e){}
try { fs.mkdirSync(path.dirname(GRYPE_PATH), { recursive: true }); } catch(e){}

const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');
if (!fs.existsSync(ALERTS_FILE)) fs.writeFileSync(ALERTS_FILE, JSON.stringify([], null, 2));

function log(msg){
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  fs.appendFileSync(path.join(LOGS_DIR,'server.log'), line);
  console.log(line.trim());
}

function safeExec(cmd, opts = {}) {
  return new Promise(resolve => {
    exec(cmd, Object.assign({ maxBuffer: 1024*1024*20, timeout: 1000*60*10 }, opts), (err, stdout, stderr) => {
      resolve({ ok: !err, code: err && err.code ? err.code : 0, stdout: (stdout||'').toString(), stderr: (stderr||'').toString() });
    });
  });
}

function readAlerts(){
  try { return JSON.parse(fs.readFileSync(ALERTS_FILE,'utf8')); } catch(e){ return []; }
}

function writeAlerts(a){ fs.writeFileSync(ALERTS_FILE, JSON.stringify(a,null,2)); }

function pushAlert(obj){
  const alerts = readAlerts();
  const a = Object.assign({ 
    id: Date.now().toString(36)+'-'+Math.floor(Math.random()*9999), 
    created_at: new Date().toISOString(), 
    status:'open' 
  }, obj);
  alerts.unshift(a);
  writeAlerts(alerts);
  log('ALERT: '+(a.id)+' '+(a.summary||''));
  return a;
}

// Enhanced logging function
function enhancedLog(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data,
    pid: process.pid,
    hostname: os.hostname()
  };
  
  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}` + 
                  (data ? ` | ${JSON.stringify(data)}` : '');
  
  // Console output
  console.log(logLine);
  
  // File logging
  const logFile = path.join(LOGS_DIR, `server-${new Date().toISOString().split('T')[0]}.log`);
  fs.appendFileSync(logFile, logLine + '\n');
  
  return logEntry;
}

// ----------------- VAN checks -----------------
async function checkAptUpdate(){
  try {
    const stamp = '/var/lib/apt/periodic/update-success-stamp';
    if (fs.existsSync(stamp)){
      const st = fs.statSync(stamp);
      const age = Math.floor((Date.now() - st.mtimeMs)/1000);
      return { ok: age < 86400, path: stamp, age_seconds: age };
    } else return { ok:false, reason:'stamp-not-found' };
  } catch(e){ return { ok:false, reason:String(e)}; }
}

async function checkHostOS(){
  return { platform: os.platform(), release: os.release(), arch: os.arch(), cpus: os.cpus().length, hostname: os.hostname() };
}

async function checkDDoS(){
  try {
    const totalCmd = "ss -tn state established | sed -n '2,$p' | wc -l";
    const r = await safeExec(totalCmd);
    const total = parseInt((r.stdout||'0').trim()||'0',10);
    const threshold = Number(process.env.DDOS_THRESHOLD_TOTAL || 150);
    const ok = total < threshold;
    if (!ok) pushAlert({ source:'van', checker:'ddos', severity:'high', summary:`DDoS suspected: ${total} established connections` });
    return { ok, total_connections: total, threshold };
  } catch(e){ return { ok:false, error:String(e) }; }
}

async function checkCPU(){
  const load1 = os.loadavg()[0] || 0;
  const cores = Math.max(1, os.cpus().length);
  const cpuPercent = Math.round((load1/cores)*100);
  const threshold = Number(process.env.CPU_THRESHOLD_PERCENT || 80);
  const ok = cpuPercent < threshold;
  if (!ok) pushAlert({ source:'van', checker:'cpu', severity:'high', summary:`High CPU approx ${cpuPercent}%` });
  return { ok, load1, cores, cpu_percent_approx:cpuPercent, threshold };
}

async function checkDisk(){
  try {
    const r = await safeExec("df -h / | awk 'NR==2{print $5}'");
    const pct = parseInt((r.stdout||'0').replace('%','')||'0',10);
    const ok = pct < 85;
    if (!ok) pushAlert({ source:'van', checker:'disk', severity:'high', summary:`Disk usage ${pct}%` });
    return { ok, percent: pct };
  } catch(e){ return { ok:false, error:String(e) }; }
}

async function checkFirewall(){
  try {
    const r = await safeExec("sudo ufw status | grep -i active || true");
    const ok = (r.stdout||'').toLowerCase().includes('active');
    if (!ok) pushAlert({ source:'van', checker:'firewall', severity:'medium', summary:'Firewall not active' });
    return { ok, stdout: r.stdout || r.stderr };
  } catch(e){ return { ok:false, error:String(e) }; }
}

async function runAllVan(){
  const out = {
    apt_update: await checkAptUpdate(),
    host_os: await checkHostOS(),
    ddos: await checkDDoS(),
    cpu: await checkCPU(),
    disk: await checkDisk(),
    firewall: await checkFirewall(),
    timestamp: new Date().toISOString()
  };
  try { fs.writeFileSync(path.join(DATA_DIR,'van_cache.json'), JSON.stringify(out,null,2)); } catch(e){}
  return out;
}

app.get('/api/van', async (req,res) => {
  try {
    const r = await runAllVan();
    res.json({ ok:true, results: r });
  } catch(e){
    res.status(500).json({ error: String(e) });
  }
});

// ----------------- Docker scans -----------------
app.post('/api/scan/docker', async (req, res) => {
  const image = req.body && req.body.image ? req.body.image.trim() : null;
  if (!image) return res.status(400).json({ error:'image required' });
  log(`Start scan for ${image}`);
  
  const trivyCmd = `trivy image --skip-update --quiet -f json -o ${TRIVY_PATH} ${image}`;
  const tr = await safeExec(trivyCmd);
  if (!tr.ok) log('trivy err: '+(tr.stderr||tr.stdout).slice(0,400));
  
  let gr = await safeExec(`grype ${image} -o json`);
  if (gr.ok && gr.stdout) {
    try { fs.writeFileSync(GRYPE_PATH, gr.stdout); } catch(e){ log('write grype out err:'+e); }
  } else { log('grype err: '+(gr.stderr||gr.stdout).slice(0,400)); }
  
  const summary = { image, trivy_ok: tr.ok, grype_ok: gr.ok, scanned_at: new Date().toISOString() };
  try { fs.writeFileSync(path.join(DATA_DIR,'last_docker_scan.json'), JSON.stringify(summary,null,2)); } catch(e){}
  
  try {
    let crits = 0;
    if (fs.existsSync(TRIVY_PATH)){
      const tj = JSON.parse(fs.readFileSync(TRIVY_PATH,'utf8'));
      (tj.Results||[]).forEach(r => (r.Vulnerabilities||[]).forEach(v => {
        if ((v.Severity||'').toUpperCase()==='CRITICAL') crits++;
      }));
    }
    if (fs.existsSync(GRYPE_PATH)){
      const gj = JSON.parse(fs.readFileSync(GRYPE_PATH,'utf8'));
      (gj.matches||[]).forEach(m => { if ((m.severity||'').toUpperCase()==='critical') crits++; });
    }
    if (crits>0) pushAlert({ source:'docker-scan', checker:'vuln', severity:'high', summary:`${crits} critical vuln(s) in ${image}`, image });
  } catch(e){ log('alert parse err:'+e); }
  
  res.json({ ok:true, image, trivy: tr.ok, grype: gr.ok });
});

app.get('/api/scan/trivy-report', (req,res) => {
  if (!fs.existsSync(TRIVY_PATH)) return res.status(404).json({ found:false });
  try { return res.type('json').send(fs.readFileSync(TRIVY_PATH,'utf8')); } catch(e){ res.status(500).json({ error:String(e) }); }
});

app.get('/api/scan/grype-report', (req,res) => {
  if (!fs.existsSync(GRYPE_PATH)) return res.status(404).json({ found:false });
  try { return res.type('json').send(fs.readFileSync(GRYPE_PATH,'utf8')); } catch(e){ res.status(500).json({ error:String(e) }); }
});

app.get('/api/scan/last-summary', (req,res) => {
  const f = path.join(DATA_DIR,'last_docker_scan.json');
  if (!fs.existsSync(f)) return res.json({ ok:true, note:'no-scan' });
  res.json(JSON.parse(fs.readFileSync(f,'utf8')));
});

// ----------------- DevSecOps auto-fix (FIXED VERSION) -----------------
const fixTasks = {};

app.post('/api/devsecops/fix-image', (req, res) => {
  const image = req.body?.image?.trim();
  if (!image) return res.status(400).json({ error: 'image required' });
  
  const taskId = `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  fixTasks[taskId] = { 
    image, 
    actions: [], 
    status: 'running', 
    when: new Date().toISOString(),
    logs: []
  };
  
  res.json({ ok: true, message: 'Auto-fix started', taskId });
  
  // Background async fix with better error handling
  (async () => {
    const out = fixTasks[taskId];
    
    try {
      if (ENABLE_REAL_FIX) {
        out.logs.push('🔧 Starting real auto-fix process...');
        
        // Step 1: Pull latest image
        out.logs.push(`📥 Pulling image: ${image}`);
        const pull = await safeExec(`docker pull ${image}`);
        out.actions.push({ action: 'docker pull', ok: pull.ok });
        if (!pull.ok) {
          out.logs.push(`❌ Failed to pull image: ${pull.stderr}`);
          throw new Error(`Pull failed: ${pull.stderr}`);
        }
        out.logs.push('✅ Image pulled successfully');
        
        // Step 2: Create container with interactive shell
        out.logs.push('🐳 Creating temporary container...');
        const cidRes = await safeExec(`docker create ${image} tail -f /dev/null`);
        const cid = cidRes.ok ? cidRes.stdout.trim() : null;
        
        if (!cid) {
          out.logs.push(`❌ Failed to create container: ${cidRes.stderr}`);
          out.actions.push({ action: 'create container', ok: false, error: cidRes.stderr });
          throw new Error('Container creation failed');
        }
        
        out.actions.push({ action: 'create container', id: cid });
        out.logs.push(`✅ Container created: ${cid}`);
        
        // Step 3: Start container
        out.logs.push('🚀 Starting container...');
        const start = await safeExec(`docker start ${cid}`);
        if (!start.ok) {
          out.logs.push(`❌ Failed to start container: ${start.stderr}`);
          await safeExec(`docker rm -f ${cid}`);
          throw new Error('Container start failed');
        }
        out.logs.push('✅ Container started');
        
        // Step 4: Detect package manager and upgrade packages
        out.logs.push('🔍 Detecting package manager...');
        
        // Test for different package managers
        const packageManagers = [
          { cmd: 'apt-get update && apt-get upgrade -y', test: 'which apt-get' },
          { cmd: 'apk update && apk upgrade', test: 'which apk' },
          { cmd: 'yum update -y', test: 'which yum' },
          { cmd: 'dnf update -y', test: 'which dnf' }
        ];
        
        let upgradeSuccess = false;
        let usedManager = 'unknown';
        
        for (const manager of packageManagers) {
          const testCmd = `docker exec ${cid} sh -c "${manager.test} >/dev/null 2>&1 && echo FOUND"`;
          const testResult = await safeExec(testCmd);
          
          if (testResult.ok && testResult.stdout.includes('FOUND')) {
            out.logs.push(`📦 Found package manager: ${manager.test.split(' ')[1]}`);
            usedManager = manager.test.split(' ')[1];
            
            // Execute package upgrade
            const upgradeCmd = `docker exec ${cid} sh -c "${manager.cmd}"`;
            out.logs.push(`🔄 Running: ${manager.cmd}`);
            const upgradeResult = await safeExec(upgradeCmd, { timeout: 1000 * 60 * 10 });
            
            out.actions.push({ 
              action: `package upgrade (${usedManager})`, 
              ok: upgradeResult.ok,
              stdout: upgradeResult.stdout.slice(0, 500),
              stderr: upgradeResult.stderr.slice(0, 500)
            });
            
            if (upgradeResult.ok) {
              upgradeSuccess = true;
              out.logs.push(`✅ Package upgrade completed with ${usedManager}`);
            } else {
              out.logs.push(`⚠️ Package upgrade had issues: ${upgradeResult.stderr.slice(0, 200)}`);
            }
            break;
          }
        }
        
        if (!upgradeSuccess) {
          out.logs.push('⚠️ No supported package manager found or upgrade failed');
        }
        
        // Step 5: Commit new image
        const newTag = `${image.replace(/[:\/]/g, '-')}-hardened-${Date.now()}`;
        out.logs.push(`📸 Committing new image: ${newTag}`);
        const commit = await safeExec(`docker commit ${cid} ${newTag}`);
        out.actions.push({ 
          action: 'docker commit', 
          ok: commit.ok, 
          newImage: newTag 
        });
        
        if (commit.ok) {
          out.newImage = newTag;
          out.logs.push(`✅ New image created: ${newTag}`);
        } else {
          out.logs.push(`❌ Failed to commit new image: ${commit.stderr}`);
        }
        
        // Step 6: Clean up container
        out.logs.push('🧹 Cleaning up temporary container...');
        await safeExec(`docker rm -f ${cid}`);
        out.logs.push('✅ Cleanup completed');
        
        // Step 7: Save detailed results
        const fileName = `fix-${Date.now()}.json`;
        fs.writeFileSync(path.join(DATA_DIR, fileName), JSON.stringify(out, null, 2));
        out.resultFile = fileName;
        out.logs.push(`💾 Results saved to: ${fileName}`);
        
      } else {
        // Simulation mode
        out.logs.push('🔒 REAL FIXES DISABLED - Running in simulation mode');
        out.actions.push({ action: 'docker pull', ok: true, simulated: true });
        out.actions.push({ action: 'create container', ok: true, simulated: true });
        out.actions.push({ action: 'package upgrade (apt-get)', ok: true, simulated: true });
        out.actions.push({ action: 'docker commit', ok: true, simulated: true });
        out.newImage = `${image}-hardened-simulated-${Date.now()}`;
        out.logs.push('✅ Simulation completed - Enable ENABLE_REAL_FIX=true for real fixes');
      }
      
      out.status = 'done';
      out.logs.push('🎉 Auto-fix process completed successfully!');
      
    } catch (e) {
      out.status = 'error';
      out.error = String(e);
      out.logs.push(`💥 Error: ${e.message}`);
    }
  })();
});

app.get('/api/devsecops/fix-result/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  const task = fixTasks[taskId];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// ----------------- Alerts + mitigation -----------------
app.get('/api/alerts', (req,res) => {
  res.json(readAlerts());
});

app.post('/api/alerts/mitigate', async (req,res) => {
  const { id } = req.body || {};
  const alerts = readAlerts();
  let a = null;
  if (id) a = alerts.find(x => x.id === id);
  else a = alerts[0];
  if (!a) return res.status(404).json({ error:'no alert found' });
  
  log('Mitigation requested for alert '+a.id+' real='+ENABLE_REAL_FIX);
  const results = [];
  try {
    if (a.checker === 'ddos') {
      if (ENABLE_REAL_FIX) {
        const uf = await safeExec('sudo ufw --force enable');
        results.push({ action:'ufw enable', ok: uf.ok, out: uf.stdout.slice(0,400) });
      } else results.push({ action:'suggest', note:'Enable ufw, add rate-limiting, investigate heavy IPs' });
    } else if (a.checker === 'cpu' || a.checker === 'load') {
      if (ENABLE_REAL_FIX) {
        const ps = await safeExec("ps -eo pid,comm,%cpu --sort=-%cpu | head -n 6");
        results.push({ action:'top-cpu', out: ps.stdout.slice(0,800) });
      } else results.push({ action:'suggest', note:'Investigate top CPU processes; consider restarting service or scaling resources' });
    } else if (a.source === 'docker-scan' || a.checker === 'vuln') {
      if (ENABLE_REAL_FIX) {
        const pull = await safeExec(`docker pull ${a.image || ''}`);
        results.push({ action:'docker pull', ok: pull.ok, out: (pull.stdout||'') });
      } else results.push({ action:'suggest', note:'Pull image and run trivy/grype; rebuild with patched base' });
    } else {
      results.push({ action:'noop', note:'No automated mitigation defined for this alert type' });
    }
  } catch(e){ results.push({ action:'error', error:String(e) }); }
  
  a.status = 'mitigated';
  a.mitigated_at = new Date().toISOString();
  a.mitigation = results;
  writeAlerts(alerts);
  res.json({ ok:true, alert: a, results });
});

// ----------------- Chat endpoint -----------------
app.post('/api/chat', async (req,res) => {
  const text = (req.body && req.body.message) ? req.body.message.toString().trim() : '';
  if (!text) return res.json({ reply: "Say something — I'm listening." });
  
  const t = text.toLowerCase();
  if (/^(hi|hello|hey|salut|سلام|مرحبا)/i.test(t)) return res.json({ reply: "Hello! I'm your DevSecOps assistant. Ask me to 'scan <image>' or 'show van' or 'alerts'." });
  if (t.includes('how are you')) return res.json({ reply: "I'm a dashboard assistant — ready to scan and mitigate." });
  
  if (t.startsWith('scan ') || t.includes('scan image') || t.includes('scan')) {
    const m = t.match(/([a-z0-9\/\-\._:]+:[a-z0-9\-\._]+|[a-z0-9\/\-\._]+:[a-z0-9\-\._]+)/i);
    if (m && m[0]) {
      const image = m[0];
      (async ()=> {
        try {
          await safeExec(`trivy image --skip-update --quiet -f json -o ${TRIVY_PATH} ${image}`);
          const gr = await safeExec(`grype ${image} -o json`);
          if (gr.ok && gr.stdout) fs.writeFileSync(GRYPE_PATH, gr.stdout);
          pushAlert({ source:'docker-scan', checker:'scan', summary:`Scanned ${image} via chat`, image });
        } catch(e){ log('chat-scan err:'+e); }
      })();
      return res.json({ reply: `Started scan for ${image}. Use Docker Scan tab to see results.` });
    } else {
      return res.json({ reply: "Tell me the image name e.g. 'scan nginx:latest'." });
    }
  }
  
  if (t.includes('van')) {
    const v = await runAllVan();
    return res.json({ reply: "VAN snapshot: " + JSON.stringify(v).slice(0,500) });
  }
  
  if (t.includes('alerts')) {
    const alerts = readAlerts();
    return res.json({ reply: `There are ${alerts.length} alert(s).` });
  }
  
  return res.json({ reply: `I understood: "${text}". You can ask me to 'scan <image>', 'show van', or 'alerts'.` });
});

app.get('/api/overview', async (req,res) => {
  const van = await runAllVan().catch(()=>null);
  const scan = fs.existsSync(path.join(DATA_DIR,'last_docker_scan.json')) ? JSON.parse(fs.readFileSync(path.join(DATA_DIR,'last_docker_scan.json'),'utf8')) : null;
  res.json({ ok:true, host: os.hostname(), van, last_scan: scan, alerts_count: readAlerts().length });
});

// ==================== GITHUB WEBHOOK DEPLOYMENT ENDPOINTS ====================

// ----------------- GitHub Webhook Deployment -----------------
app.post('/api/deploy', (req, res) => {
    const { secret } = req.body;
    const expectedSecret = process.env.DEPLOY_SECRET;
    
    enhancedLog('info', '🚀 Webhook deployment triggered', { 
        hasSecret: !!secret, 
        hasExpectedSecret: !!expectedSecret 
    });
    
    // Verify secret
    if (!expectedSecret || secret !== expectedSecret) {
        enhancedLog('warn', '❌ Invalid deploy secret attempt');
        return res.status(401).json({ 
            error: 'Unauthorized',
            message: 'Invalid deployment secret'
        });
    }
    
    // Send immediate response
    res.json({ 
        status: 'deployment_started',
        message: 'Deployment process initiated',
        timestamp: new Date().toISOString(),
        taskId: `deploy-${Date.now()}`
    });
    
    // Execute deployment in background
    enhancedLog('info', '🔄 Starting deployment process in background...');
    const { exec } = require('child_process');
    
    exec('cd /home/ubuntu/FIRAS_PFE_2025 && chmod +x deploy.sh && ./deploy.sh', 
        (error, stdout, stderr) => {
            if (error) {
                enhancedLog('error', '❌ Deployment script failed', { 
                    error: error.message,
                    exitCode: error.code
                });
                return;
            }
            enhancedLog('info', '✅ Deployment script completed', {
                stdout: stdout.slice(0, 500), // First 500 chars
                stderr: stderr ? stderr.slice(0, 500) : null
            });
        });
});

// ----------------- Enhanced Health Check -----------------
app.get('/health', (req, res) => {
    const health = {
        status: 'healthy',
        service: 'DevSecOps Dashboard',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        nodeVersion: process.version,
        platform: os.platform()
    };
    
    res.json(health);
});

// ----------------- Root Endpoint -----------------
app.get('/', (req, res) => {
    res.json({
        message: 'DevSecOps Dashboard API',
        version: '1.0.0',
        description: 'Docker Security Test and Re-Build Dashboard',
        endpoints: {
            health: '/health (GET)',
            deploy: '/api/deploy (POST)',
            van: '/api/van (GET)',
            scan: '/api/scan/docker (POST)',
            alerts: '/api/alerts (GET)',
            chat: '/api/chat (POST)',
            overview: '/api/overview (GET)'
        },
        github: {
            workflow: 'Auto-deployment via GitHub Actions',
            webhook: 'POST /api/deploy with secret'
        }
    });
});

// ==================== SERVER START ====================

app.listen(PORT, () => {
    enhancedLog('info', 'Server started', { 
        port: PORT, 
        realFix: ENABLE_REAL_FIX,
        nodeEnv: process.env.NODE_ENV || 'development'
    });
    console.log(`🚀 DevSecOps Dashboard running on http://localhost:${PORT}`);
    console.log(`🔧 ENABLE_REAL_FIX: ${ENABLE_REAL_FIX}`);
    console.log(`🌐 Health check: http://localhost:${PORT}/health`);
    console.log(`🔄 Deploy endpoint: POST http://localhost:${PORT}/api/deploy`);
});
