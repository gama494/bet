const firebaseConfig = {
  apiKey: "AIzaSyAoZWQtBzdvipLlw2FWzoexyqLtK_gxr1g",
  authDomain: "kris-tech.firebaseapp.com",
  databaseURL: "https://kris-tech-default-rtdb.firebaseio.com",
  projectId: "kris-tech",
  storageBucket: "kris-tech.firebasestorage.app",
  messagingSenderId: "105383566272",
  appId: "1:105383566272:web:e42f7cc7de92fa5ab10625"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// reCAPTCHA
let recaptchaVerifier;
window.onload = () => {
  recaptchaVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', { size: 'invisible' });
};

/* =============== COUNTRIES =============== */
const countryCodes = [
  { name: "Malawi", code: "+265", iso: "mw" },
  { name: "India", code: "+91", iso: "in" },
  { name: "Nigeria", code: "+234", iso: "ng" },
  { name: "Kenya", code: "+254", iso: "ke" },
  { name: "Ghana", code: "+233", iso: "gh" },
  { name: "South Africa", code: "+27", iso: "za" }
].sort((a, b) => a.name.localeCompare(b.name));

document.querySelectorAll('.country-select').forEach(sel => {
  countryCodes.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.code;
    opt.textContent = `${c.name} (${c.code})`;
    opt.dataset.iso = c.iso;
    sel.appendChild(opt);
  });
  sel.value = "+265";
});

function formatCountry(state) {
  if (!state.id) return state.text;
  const iso = state.element.dataset.iso;
  return $(`<span><img src="https://flagcdn.com/28x21/${iso}.png" class="img-flag me-2"/> ${state.text}</span>`);
}
$('.country-select').select2({ templateResult: formatCountry, templateSelection: formatCountry });

/* =============== HELPERS =============== */
function setLoading(btn, loading) {
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}
function showAlert(msg, type = 'danger') {
  const container = document.querySelector('.card-body');
  const existing = container.querySelector('.alert');
  if (existing) existing.remove();
  const alert = document.createElement('div');
  alert.className = `alert alert-${type} alert-dismissible fade show mt-3`;
  alert.innerHTML = `${msg}<button type="button" class="btn-close btn-close-white" data-bs-dismiss="alert"></button>`;
  container.prepend(alert);
}

/* =============== SIGNUP =============== */
document.getElementById('signupForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const country = document.getElementById('signupCountry').value;
  const phone = document.getElementById('signupPhone').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pwd = document.getElementById('signupPassword').value;
  const cpwd = document.getElementById('signupConfirmPassword').value;

  if (!phone || !email || !pwd || pwd !== cpwd) return showAlert('Fill all fields / passwords must match');
  if (pwd.length < 6) return showAlert('Password must be 6+ characters');

  const fullPhone = country + phone;
  setLoading(btn, true);
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pwd);
    const uid = cred.user.uid;
    const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`;

    await db.collection('betting').doc(uid).set({
      phone: fullPhone,
      email: email,
      avatar: avatarUrl,
      uid: uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showAlert('Account created! Redirecting...', 'success');
    setTimeout(() => window.location.href = 'main.html', 1500);
  } catch (err) {
    showAlert(err.message);
  } finally {
    setLoading(btn, false);
  }
});

/* =============== LOGIN BY PHONE – SPARK PLAN =============== */
document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const country = document.getElementById('loginCountry').value;
  const phone = document.getElementById('loginPhone').value.trim();
  const pwd = document.getElementById('loginPassword').value;

  if (!phone || !pwd) return showAlert('Enter phone and password');

  const fullPhone = country + phone;
  setLoading(btn, true);

  try {
    // SEARCH FIRESTORE BY PHONE
    const snapshot = await db
      .collection('betting')
      .where('phone', '==', fullPhone)
      .limit(1)
      .get();

    if (snapshot.empty) {
      showAlert('No account found with this phone');
      setLoading(btn, false);
      return;
    }

    const userDoc = snapshot.docs[0].data();
    const email = userDoc.email;

    // SIGN IN WITH EMAIL + PASSWORD
    await auth.signInWithEmailAndPassword(email, pwd);
    window.location.href = 'main.html';

  } catch (err) {
    console.error(err);
    if (err.code === 'auth/wrong-password') {
      showAlert('Incorrect password');
    } else if (err.code === 'auth/user-not-found') {
      showAlert('No account found');
    } else {
      showAlert('Login failed. Try again.');
    }
  } finally {
    setLoading(btn, false);
  }
});

/* =============== FORGOT PASSWORD =============== */
document.getElementById('forgotBtn').addEventListener('click', () => {
  document.querySelector('#login').classList.remove('show', 'active');
  document.getElementById('forgotSection').style.display = 'block';
});

document.getElementById('backToLoginBtn').addEventListener('click', () => {
  document.getElementById('login').classList.add('show', 'active');
  document.getElementById('forgotSection').style.display = 'none';
});

document.getElementById('sendResetBtn').addEventListener('click', async () => {
  const btn = document.getElementById('sendResetBtn');
  const country = document.getElementById('forgotCountry').value;
  const phone = document.getElementById('forgotPhone').value.trim();
  if (!phone) return showAlert('Enter phone number');
  const fullPhone = country + phone;
  setLoading(btn, true);
  try {
    const snapshot = await db.collection('betting').where('phone', '==', fullPhone).limit(1).get();
    if (snapshot.empty) {
      showAlert('No account found');
      return;
    }
    const email = snapshot.docs[0].data().email;
    await auth.sendPasswordResetEmail(email);
    showAlert(`Reset link sent to ${email}`, 'success');
  } catch (err) {
    showAlert('Server error');
  } finally {
    setLoading(btn, false);
  }
});