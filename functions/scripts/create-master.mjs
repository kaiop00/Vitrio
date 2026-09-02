import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const email = process.env.MASTER_EMAIL || 'kaioportela10@gmail.com';
const password = process.env.MASTER_PASSWORD;

if (!password || password.length < 6) {
  console.error('Defina MASTER_PASSWORD no ambiente antes de executar.');
  process.exit(1);
}

if (!getApps().length) initializeApp({ credential: applicationDefault() });
const auth = getAuth();
const db = getFirestore();

let user;
try {
  user = await auth.getUserByEmail(email);
  await auth.updateUser(user.uid, { password, displayName: 'Kaio Portela' });
  console.log('Usuário existente atualizado no Firebase Auth.');
} catch (err) {
  if (err?.code !== 'auth/user-not-found') throw err;
  user = await auth.createUser({ email, password, displayName: 'Kaio Portela', emailVerified: true });
  console.log('Usuário criado no Firebase Auth.');
}

await db.doc(`users/${user.uid}`).set({
  displayName: 'Kaio Portela',
  email,
  role: 'admin',
  active: true,
  isStoreOwner: false,
  updatedAt: FieldValue.serverTimestamp(),
  createdAt: FieldValue.serverTimestamp()
}, { merge: true });

console.log(`Master configurado: ${email}`);
console.log(`UID: ${user.uid}`);
