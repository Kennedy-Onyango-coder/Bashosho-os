async function testRegression() {
  const BASE_URL = 'http://localhost:3000';
  console.log('=== Starting Role Rename Regression Test ===\n');

  // 1. Login as Chairperson
  console.log('1. Logging in as Chairperson (konyango98@gmail.com)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailOrPhone: 'konyango98@gmail.com', password: '1234' })
  });

  if (!loginRes.ok) {
    const errText = await loginRes.text();
    console.error('Login failed:', loginRes.status, errText);
    process.exit(1);
  }

  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('   Logged in successfully. User:', loginData.user.name, '| Role:', loginData.user.role, '| RoleKey:', loginData.user.roleKey);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Cookie': `session_token=${token}`
  };

  // 2. Fetch current roles to get chairperson role ID
  console.log('\n2. Fetching roles list...');
  const rolesRes = await fetch(`${BASE_URL}/api/roles`, { headers: authHeaders });
  const rawRolesData = await rolesRes.json();
  
  const roles = Array.isArray(rawRolesData) ? rawRolesData : (rawRolesData.roles || []);
  if (!Array.isArray(roles) || roles.length === 0) {
    console.error('   Error fetching roles:', rolesRes.status, rawRolesData);
    process.exit(1);
  }
  
  console.log('   Found roles:', roles.map(r => `${r.id} (${r.name}, key: ${r.roleKey})`));

  const chairpersonRole = roles.find(r => r.roleKey === 'chairperson') || roles.find(r => r.id === 'chairperson');
  if (!chairpersonRole) {
    console.error('   Error: Chairperson role not found in:', roles);
    process.exit(1);
  }

  // 3. STEP 6 TEST: Rename Chairperson role to "Executive Director"
  console.log('\n3. [STEP 6 TEST] Renaming Chairperson role name to "Executive Director"...');
  const renameChairRes = await fetch(`${BASE_URL}/api/roles/${chairpersonRole.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Executive Director', description: 'CBO Executive Chief Officer' })
  });

  if (!renameChairRes.ok) {
    console.error('   Failed to rename Chairperson role:', await renameChairRes.text());
    process.exit(1);
  }

  const chairRenameData = await renameChairRes.json();
  console.log('   Chairperson role renamed successfully:', chairRenameData.role);

  // 4. Verify Chairperson access to admin endpoints after renaming
  console.log('\n4. Verifying Chairperson STILL HAS ACCESS to admin endpoints after role rename...');
  
  // Test access to /api/roles (chairperson only)
  const checkRolesRes = await fetch(`${BASE_URL}/api/roles`, { headers: authHeaders });
  console.log('   GET /api/roles status:', checkRolesRes.status, checkRolesRes.status === 200 ? 'SUCCESS [200 OK]' : 'FAILED');

  // Test access to /api/safeguarding (chairperson / safeguarding officer only)
  const checkSafeguardingRes = await fetch(`${BASE_URL}/api/safeguarding`, { headers: authHeaders });
  console.log('   GET /api/safeguarding status:', checkSafeguardingRes.status, checkSafeguardingRes.status === 200 ? 'SUCCESS [200 OK]' : 'FAILED');

  // Test access to /api/admin/export (chairperson only)
  const checkExportRes = await fetch(`${BASE_URL}/api/admin/export`, { headers: authHeaders });
  console.log('   GET /api/admin/export status:', checkExportRes.status, checkExportRes.status === 200 ? 'SUCCESS [200 OK]' : 'FAILED');

  if (checkRolesRes.status !== 200 || checkSafeguardingRes.status !== 200 || checkExportRes.status !== 200) {
    console.error('   REGRESSION DETECTED! Chairperson was locked out after role rename.');
    process.exit(1);
  } else {
    console.log('   >>> STEP 6 CONFIRMED: Chairperson retains full admin access after role display name changed to "Executive Director"! <<<');
  }

  // 5. STEP 7 TEST: Rename Treasurer role to "Chief Financial Officer"
  console.log('\n5. [STEP 7 TEST] Renaming Treasurer role name to "Chief Financial Officer"...');
  const treasurerRole = roles.find(r => r.roleKey === 'treasurer') || roles.find(r => r.id === 'treasurer');
  if (!treasurerRole) {
    console.error('   Error: Treasurer role not found!');
    process.exit(1);
  }

  const renameTreasRes = await fetch(`${BASE_URL}/api/roles/${treasurerRole.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Chief Financial Officer', description: 'Head of Financial Operations' })
  });

  if (!renameTreasRes.ok) {
    console.error('   Failed to rename Treasurer role:', await renameTreasRes.text());
    process.exit(1);
  }

  console.log('   Treasurer role renamed successfully to "Chief Financial Officer"');

  // Verify access to financial endpoints requiring chairperson or treasurer
  const checkIncomeRes = await fetch(`${BASE_URL}/api/incomes`, { headers: authHeaders });
  console.log('   GET /api/incomes status:', checkIncomeRes.status, checkIncomeRes.status === 200 ? 'SUCCESS [200 OK]' : 'FAILED');

  if (checkIncomeRes.status !== 200) {
    console.error('   REGRESSION DETECTED! Financial access failed after Treasurer rename.');
    process.exit(1);
  } else {
    console.log('   >>> STEP 7 CONFIRMED: Treasurer rename executed cleanly without impacting roleKey authorization! <<<');
  }

  // Restore display names
  console.log('\n6. Restoring original role display names ("Chairperson (Admin)", "Treasurer")...');
  await fetch(`${BASE_URL}/api/roles/${chairpersonRole.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Chairperson (Admin)', description: 'CBO Chief Executive Officer & Admin' })
  });
  await fetch(`${BASE_URL}/api/roles/${treasurerRole.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Treasurer', description: 'Financial Custodian & Approver' })
  });
  console.log('   Roles restored to default display names.');

  console.log('\n=== ALL REGRESSION TESTS PASSED SUCCESSFULLY! ===');
}

testRegression().catch(err => {
  console.error('Unexpected error during test execution:', err);
  process.exit(1);
});
