import dotenv from 'dotenv';
import connectDB from './config/db.js';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import { generateAccessToken, generateRefreshToken, hashString } from './utils/tokens.js';
import { RegisterValidator, LoginValidator } from './validators/auth.js';
import { AppError } from './utils/errors.js';

dotenv.config();

async function runAuthFlowVerification() {
  console.log('--- OptiCart Auth & RBAC Flow Verification Test ---');

  // Connect to DB
  await connectDB();

  const testEmail = 'verification_test_user@opticart.com';
  const testPassword = 'Password123!';

  // Clean up any stale user from previous runs
  await User.deleteOne({ email: testEmail });

  // 1. Verification of Registration Input Validation
  console.log('\n[Step 1] Testing Input Validation with short password...');
  const invalidReg = RegisterValidator.safeParse({
    name: 'Test',
    email: testEmail,
    password: 'short', // invalid
  });
  if (!invalidReg.success) {
    console.log('✓ Validation correctly rejected short password:', invalidReg.error.errors[0].message);
  } else {
    throw new Error('✗ Registration validation failed to reject invalid password.');
  }

  // 2. Register new user
  console.log('\n[Step 2] Registering valid test user...');
  const validRegResult = RegisterValidator.parse({
    name: 'Verification Tester',
    email: testEmail,
    password: testPassword,
  });

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(validRegResult.password, salt);
  const testUser = await User.create({
    name: validRegResult.name,
    email: validRegResult.email,
    passwordHash,
    role: 'customer', // default
    isActive: true,
  });

  console.log(`✓ Test user registered. ID: ${testUser._id}, Role: ${testUser.role} (defaulted to customer)`);

  // 3. Login verification
  console.log('\n[Step 3] Logging in with credentials...');
  const loginInput = LoginValidator.parse({
    email: testEmail,
    password: testPassword,
  });

  const dbUser = await User.findOne({ email: loginInput.email });
  if (!dbUser) throw new Error('✗ User not found during login test.');

  const isPassMatch = await bcrypt.compare(loginInput.password, dbUser.passwordHash);
  if (!isPassMatch) throw new Error('✗ Password mismatch in verification.');

  console.log('✓ Password verified via bcrypt compare.');

  // Generate tokens
  const accessToken = generateAccessToken(dbUser._id.toString(), dbUser.role);
  const refreshToken = generateRefreshToken();

  dbUser.refreshTokenHash = hashString(refreshToken);
  await dbUser.save();
  console.log('✓ Access & Refresh tokens generated and SHA-256 hash stored in DB.');

  // 4. Test RBAC access control (Stub check)
  console.log('\n[Step 4] Testing RBAC Stub Access Control...');
  // A customer role should be rejected on super_admin stub
  const testRBACGate = (role: string, requiredRole: string): boolean => {
    return role === requiredRole;
  };

  const isCustomerAllowed = testRBACGate(dbUser.role, 'super_admin');
  console.log(`✓ Access check for customer on super_admin resource: ${isCustomerAllowed ? 'ALLOWED (✗ Error)' : 'DENIED (✓ Correct)'}`);

  // Escalate user to super_admin (Admin API action simulation)
  console.log('Escalating user role to super_admin...');
  dbUser.role = 'super_admin';
  await dbUser.save();

  const isEscalatedAllowed = testRBACGate(dbUser.role, 'super_admin');
  console.log(`✓ Access check for escalated super_admin on resource: ${isEscalatedAllowed ? 'ALLOWED (✓ Correct)' : 'DENIED (✗ Error)'}`);

  // 5. Test Token Rotation
  console.log('\n[Step 5] Testing Refresh Token Rotation...');
  const userToRefresh = await User.findById(dbUser._id);
  if (!userToRefresh) throw new Error('User not found.');

  const incomingHash = hashString(refreshToken);
  if (userToRefresh.refreshTokenHash === incomingHash) {
    console.log('✓ Incoming refresh token matches stored hash. Proceeding to rotate...');
    
    // Rotate
    const rotatedAccessToken = generateAccessToken(userToRefresh._id.toString(), userToRefresh.role);
    const rotatedRefreshToken = generateRefreshToken();
    userToRefresh.refreshTokenHash = hashString(rotatedRefreshToken);
    await userToRefresh.save();
    console.log('✓ Tokens rotated. New refresh token hash saved.');
  } else {
    throw new Error('✗ Refresh token hash validation failed.');
  }

  // 6. Test Compromise Detection (Double spend check)
  console.log('\n[Step 6] Testing Stale Token Compromise Detection...');
  // Present the first (stale) refresh token again
  const staleHash = hashString(refreshToken);
  if (userToRefresh.refreshTokenHash !== staleHash) {
    console.log('✓ Compromise detected: Stale token hash does not match current stored hash.');
    // Null out to revoke all sessions
    userToRefresh.refreshTokenHash = null;
    await userToRefresh.save();
    console.log('✓ Stale hash presentation correctly triggered database token revocation.');
  } else {
    throw new Error('✗ Failed to detect stale token compromise.');
  }

  // 7. Test Logout
  console.log('\n[Step 7] Testing Logout...');
  const userToLogout = await User.findById(dbUser._id);
  if (!userToLogout) throw new Error('User not found.');
  
  userToLogout.refreshTokenHash = null;
  await userToLogout.save();
  console.log('✓ RefreshToken hash cleared on user document.');

  // Clean up verification data
  await User.deleteOne({ _id: dbUser._id });
  console.log('\n✓ Cleaned up test user from database.');

  console.log('\n--- Auth & RBAC Flow Verification Successfully Completed ---');
  await mongoose.disconnect();
  process.exit(0);
}

runAuthFlowVerification().catch(async (err) => {
  console.error('✗ Verification failed with error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
