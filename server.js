require('dotenv').config();
const express = require('express');
const cookieSession = require('cookie-session');
const path = require('path');
const { Firestore } = require('@google-cloud/firestore');

const app = express();
const PORT = process.env.PORT || 8080;

// Local in-memory store for local fallback when Google Cloud Credentials are not loaded
const localStore = {
  teams: {},
  votes: {}
};

class MockCollection {
  constructor(name) {
    this.name = name;
  }

  doc(id) {
    return {
      id: id,
      ref: { collection: this.name, id: id },
      get: async () => {
        const data = localStore[this.name][id];
        return {
          exists: !!data,
          id: id,
          data: () => data ? JSON.parse(JSON.stringify(data)) : null
        };
      },
      set: async (data) => {
        localStore[this.name][id] = JSON.parse(JSON.stringify(data));
        return { success: true };
      },
      update: async (data) => {
        if (!localStore[this.name][id]) localStore[this.name][id] = {};
        Object.assign(localStore[this.name][id], JSON.parse(JSON.stringify(data)));
        return { success: true };
      }
    };
  }

  orderBy() {
    return this; // ordering handled at return-time to keep mock simple
  }

  async get() {
    const docs = [];
    for (const id in localStore[this.name]) {
      docs.push({
        id: id,
        ref: { collection: this.name, id: id },
        data: () => JSON.parse(JSON.stringify(localStore[this.name][id]))
      });
    }
    return {
      empty: docs.length === 0,
      forEach: (callback) => docs.forEach(callback)
    };
  }
}

class MockFirestore {
  collection(name) {
    if (!localStore[name]) {
      localStore[name] = {};
    }
    return new MockCollection(name);
  }

  batch() {
    const updates = [];
    return {
      update: (docRef, data) => {
        updates.push({ action: 'update', collection: docRef.ref.collection, id: docRef.id, data });
      },
      delete: (docRef) => {
        updates.push({ action: 'delete', collection: docRef.ref.collection, id: docRef.id });
      },
      commit: async () => {
        for (const up of updates) {
          if (up.action === 'update') {
            if (!localStore[up.collection][up.id]) localStore[up.collection][up.id] = {};
            Object.assign(localStore[up.collection][up.id], JSON.parse(JSON.stringify(up.data)));
          } else if (up.action === 'delete') {
            delete localStore[up.collection][up.id];
          }
        }
      }
    };
  }
}

// Global DB client
let db;
let isMockDb = false;

function initializeDatabase() {
  try {
    const firestoreOptions = {};
    if (process.env.GOOGLE_CLOUD_PROJECT) {
      firestoreOptions.projectId = process.env.GOOGLE_CLOUD_PROJECT;
    }
    db = new Firestore(firestoreOptions);
    console.log('Attempting to connect to Google Cloud Firestore...');
  } catch (err) {
    console.warn('WARNING: Failed to instantiate Firestore client. Falling back to in-memory Mock Database.');
    db = new MockFirestore();
    isMockDb = true;
  }
}

initializeDatabase();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Secure Session management via HttpOnly & Lax SameSite cookies
app.use(cookieSession({
  name: 'jago_session',
  keys: [process.env.SESSION_SECRET || 'ephemeralsecretkey123!@#'],
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  httpOnly: true
}));

// Allowed emails list matching the exact 57 emails from request
const ALLOWED_EMAILS = new Set([
  "gian.wibowo@tech.jago.com",
  "hendrix@tech.jago.com",
  "audi.oroh@tech.jago.com",
  "aldila.iskandar@tech.jago.com",
  "chris.samuel@tech.jago.com",
  "iqbal.faaizi@tech.jago.com",
  "fadel.nassim@tech.jago.com",
  "edi.hutasoit@tech.jago.com",
  "ik-adhitya.panji@aux.dkatalis.com",
  "figo.fosandy@tech.jago.com",
  "charel.matulessy@tech.jago.com",
  "sanjay.sah@tech.jago.com",
  "seindy.evan@tech.jago.com",
  "sepran.ashari@tech.jago.com",
  "debimantara.janur@tech.jago.com",
  "iqbal.hafid@tech.jago.com",
  "karimah.najiyah@tech.jago.com",
  "fadillah.hadiyanto@tech.jago.com",
  "iqbal.fakhri@tech.jago.com",
  "ichroman.duwila@tech.jago.com",
  "ardianto@tech.jago.com",
  "shanon.saga@tech.jago.com",
  "eko.saputro@tech.jago.com",
  "edwin.romelta@tech.jago.com",
  "willyanto@tech.jago.com",
  "rahul.tiwari@tech.jago.com",
  "harshal.bhamare@tech.jago.com",
  "sagar.deshmukh@tech.jago.com",
  "kunal.chavanke@tech.jago.com",
  "mohammed.sayyed@tech.jago.com",
  "ankit.jha@tech.jago.com",
  "prem.das@tech.jago.com",
  "marian.ganuci@tech.jago.com",
  "giorgi.rokhadze@tech.jago.com",
  "liudmila.novikova@tech.jago.com",
  "alexey.popov@tech.jago.com",
  "kalaszi.adrian@tech.jago.com",
  "laras.bestari@tech.jago.com",
  "raymundus.prasetya@tech.jago.com",
  "johanes.brahmantya@tech.jago.com",
  "rahda.sungkar@tech.jago.com",
  "sanelita.thariqi@tech.jago.com",
  "stephan.dowding@tech.jago.com",
  "andhika.nugraha@tech.jago.com",
  "faisal.reza@tech.jago.com",
  "fajar.firdaus@tech.jago.com",
  "benoit.auger@tech.jago.com",
  "aruna.anggayasti@dkatalis.com",
  "safira.hardhani@dkatalis.com",
  "amri.luthfi@jago.com",
  "vo-alifian.diasanada@tech.jago.com",
  "ady.rizki@jago.com",
  "tiara.zakaria@jago.com",
  "rahmadani.syarif@jago.com",
  "annisa.singgih@dkatalis.com",
  "safiera.arryena@dkatalis.com",
  "aux-nakita.dinanti@tech.jago.com"
]);

const ADMIN_EMAIL = "admin@clifftangel.altostrat.com";

// Seeding function for default 8 teams
async function seedDefaultTeams() {
  try {
    const teamsRef = db.collection('teams');
    const snapshot = await teamsRef.get();
    if (snapshot.empty) {
      console.log('Seeding default hackathon teams...');
      for (let i = 1; i <= 8; i++) {
        await teamsRef.doc(`team_${i}`).set({
          id: `team_${i}`,
          name: `Team ${i}`,
          index: i - 1
        });
      }
      console.log('Seeding default teams complete.');
    } else {
      console.log('Teams collection already initialized.');
    }
  } catch (err) {
    if (err.message && err.message.includes('Could not load the default credentials')) {
      console.warn('Google Credentials not loaded. Automatically switching database instance to local Mock Mode.');
      isMockDb = true;
      db = new MockFirestore();
      await seedDefaultTeams(); // retry on the mock DB
    } else {
      console.error('Error seeding teams collection:', err);
    }
  }
}

// Call seed function immediately after startup
seedDefaultTeams();

// Serve Static Files from /public directory
app.use(express.static(path.join(__dirname, 'public')));

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.email) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || req.session.role !== 'admin') {
    return res.status(403).json({ error: 'Access forbidden: Administrators only.' });
  }
  next();
}

// Auth Endpoints
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const cleanEmail = email.trim().toLowerCase();
  
  if (cleanEmail === ADMIN_EMAIL || ALLOWED_EMAILS.has(cleanEmail)) {
    req.session.email = cleanEmail;
    req.session.role = cleanEmail === ADMIN_EMAIL ? 'admin' : 'voter';
    return res.json({
      success: true,
      email: cleanEmail,
      role: req.session.role
    });
  }
  return res.status(403).json({ error: 'Access denied: You are not in the allowed voter list.' });
});

app.post('/api/logout', (req, res) => {
  req.session = null;
  res.json({ success: true });
});

app.get('/api/me', (req, res) => {
  if (req.session && req.session.email) {
    return res.json({
      loggedIn: true,
      email: req.session.email,
      role: req.session.role
    });
  }
  return res.json({ loggedIn: false });
});

// Teams Endpoints
app.get('/api/teams', requireAuth, async (req, res) => {
  try {
    const teamsSnapshot = await db.collection('teams').get();
    const teams = [];
    teamsSnapshot.forEach(doc => {
      teams.push(doc.data());
    });
    // handle sorting manually for the mock collection
    teams.sort((a, b) => a.index - b.index);
    res.json(teams);
  } catch (err) {
    console.error('Error fetching teams:', err);
    res.status(500).json({ error: 'Failed to retrieve teams' });
  }
});

app.post('/api/admin/teams', requireAuth, requireAdmin, async (req, res) => {
  const { teams } = req.body; // array of { id, name }
  if (!Array.isArray(teams)) {
    return res.status(400).json({ error: 'Invalid teams data payload.' });
  }
  try {
    const batch = db.batch();
    for (const t of teams) {
      if (!t.id || !t.name) continue;
      const docRef = db.collection('teams').doc(t.id);
      batch.update(docRef, { name: t.name.trim() });
    }
    await batch.commit();
    res.json({ success: true, message: 'Team names updated successfully.' });
  } catch (err) {
    console.error('Error batch updating team names:', err);
    res.status(500).json({ error: 'Failed to save updated team names.' });
  }
});

// Voting Endpoints
app.get('/api/votes/my-votes', requireAuth, async (req, res) => {
  try {
    const doc = await db.collection('votes').doc(req.session.email).get();
    if (doc.exists) {
      res.json(doc.data().votes || {});
    } else {
      res.json({});
    }
  } catch (err) {
    console.error('Error retrieving user votes:', err);
    res.status(500).json({ error: 'Failed to retrieve your previous votes' });
  }
});

app.post('/api/votes', requireAuth, async (req, res) => {
  const { votes } = req.body; // map of team_id -> { criteria_1, criteria_2, criteria_3 }
  if (!votes || typeof votes !== 'object') {
    return res.status(400).json({ error: 'Invalid votes structure.' });
  }

  // Validate the scores are 1-5 integers
  for (const teamId in votes) {
    const v = votes[teamId];
    if (typeof v.criteria_1 !== 'number' || v.criteria_1 < 1 || v.criteria_1 > 5 ||
        typeof v.criteria_2 !== 'number' || v.criteria_2 < 1 || v.criteria_2 > 5 ||
        typeof v.criteria_3 !== 'number' || v.criteria_3 < 1 || v.criteria_3 > 5) {
      return res.status(400).json({ error: `Scores for ${teamId} must be integer ratings between 1 and 5.` });
    }
  }

  try {
    await db.collection('votes').doc(req.session.email).set({
      voter_email: req.session.email,
      voted_at: new Date().toISOString(),
      votes
    });
    res.json({ success: true, message: 'Your votes were successfully recorded!' });
  } catch (err) {
    console.error('Error writing votes to database:', err);
    res.status(500).json({ error: 'Failed to record your votes.' });
  }
});

// Admin Dashboard Endpoints
app.get('/api/admin/progress', requireAuth, requireAdmin, async (req, res) => {
  try {
    const votesSnapshot = await db.collection('votes').get();
    const votedEmails = [];
    votesSnapshot.forEach(doc => {
      votedEmails.push(doc.id);
    });

    const allVoters = Array.from(ALLOWED_EMAILS);
    const progressList = allVoters.map(email => ({
      email,
      voted: votedEmails.includes(email)
    })).sort((a, b) => b.voted - a.voted || a.email.localeCompare(b.email));

    res.json({
      totalVoters: allVoters.length,
      votedCount: votedEmails.length,
      progress: progressList
    });
  } catch (err) {
    console.error('Error fetching admin progress:', err);
    res.status(500).json({ error: 'Failed to fetch voting progress.' });
  }
});

app.post('/api/admin/reset', requireAuth, requireAdmin, async (req, res) => {
  try {
    const votesSnapshot = await db.collection('votes').get();
    if (!votesSnapshot.empty) {
      const batch = db.batch();
      votesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    res.json({ success: true, message: 'All votes have been successfully reset.' });
  } catch (err) {
    console.error('Error resetting votes:', err);
    res.status(500).json({ error: 'Failed to reset voting data.' });
  }
});

// Results Endpoint
app.get('/api/results', requireAuth, async (req, res) => {
  try {
    // 1. Fetch all teams
    const teamsSnapshot = await db.collection('teams').get();
    const teamsMap = {};
    teamsSnapshot.forEach(doc => {
      const data = doc.data();
      teamsMap[data.id] = {
        id: data.id,
        name: data.name,
        c1_sum: 0,
        c2_sum: 0,
        c3_sum: 0,
        voter_count: 0
      };
    });

    // 2. Fetch all votes
    const votesSnapshot = await db.collection('votes').get();
    votesSnapshot.forEach(doc => {
      const data = doc.data();
      const userVotes = data.votes || {};
      for (const teamId in userVotes) {
        if (teamsMap[teamId]) {
          const v = userVotes[teamId];
          teamsMap[teamId].c1_sum += v.criteria_1 || 0;
          teamsMap[teamId].c2_sum += v.criteria_2 || 0;
          teamsMap[teamId].c3_sum += v.criteria_3 || 0;
          teamsMap[teamId].voter_count += 1;
        }
      }
    });

    // 3. Compute Averages
    const results = Object.values(teamsMap).map(team => {
      const count = team.voter_count || 0;
      const c1_avg = count > 0 ? Number((team.c1_sum / count).toFixed(2)) : 0.0;
      const c2_avg = count > 0 ? Number((team.c2_sum / count).toFixed(2)) : 0.0;
      const c3_avg = count > 0 ? Number((team.c3_sum / count).toFixed(2)) : 0.0;

      return {
        id: team.id,
        name: team.name,
        voterCount: count,
        c1: c1_avg,
        c2: c2_avg,
        c3: c3_avg,
        // Cumulative averages across each step
        p1_cumulative: c1_avg,
        p2_cumulative: Number((c1_avg + c2_avg).toFixed(2)),
        p3_cumulative: Number((c1_avg + c2_avg + c3_avg).toFixed(2))
      };
    });

    res.json(results);
  } catch (err) {
    console.error('Error calculating results aggregation:', err);
    res.status(500).json({ error: 'Failed to aggregate results data.' });
  }
});

// Wildcard routing to redirect unhandled API requests or serve 404
app.get('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

// Start listening
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
  if (isMockDb) {
    console.log('Running in local Mock Mode. Live Firestore deactivated.');
  }
});
