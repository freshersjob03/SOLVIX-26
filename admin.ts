import './theme.css';
import {
  fetchAllRegistrations,
  updateTeamStatus,
  SUPABASE_SCHEMA_SQL,
  Team,
  TeamMember,
} from './supabase';

document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('loginView');
  const dashboardView = document.getElementById('dashboardView');
  const adminLoginForm = document.getElementById('adminLoginForm') as HTMLFormElement | null;
  const adminPassInput = document.getElementById('adminPass') as HTMLInputElement | null;
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  // Stats
  const statTotal = document.getElementById('statTotal');
  const statSlots = document.getElementById('statSlots');
  const statVerified = document.getElementById('statVerified');
  const statPending = document.getElementById('statPending');
  const statRevenue = document.getElementById('statRevenue');

  // Table & Controls
  const regTableBody = document.getElementById('regTableBody');
  const searchInput = document.getElementById('searchInput') as HTMLInputElement | null;
  const statusFilter = document.getElementById('statusFilter') as HTMLSelectElement | null;
  const refreshBtn = document.getElementById('refreshBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');

  // Modals
  const detailModal = document.getElementById('detailModal');
  const closeDetailBtn = document.getElementById('closeDetailBtn');
  const sqlModal = document.getElementById('sqlModal');
  const showSqlBtn = document.getElementById('showSqlBtn');
  const closeSqlBtn = document.getElementById('closeSqlBtn');
  const copySqlBtn = document.getElementById('copySqlBtn');
  const sqlCodeBlock = document.getElementById('sqlCodeBlock');

  let allTeams: Team[] = [];

  /* ---- 1. Auth Management ---- */
  const ADMIN_PASSCODE = 'solvix2026';

  function checkAuth() {
    const isAuthed = sessionStorage.getItem('solvix_admin_auth') === 'true';
    if (isAuthed) {
      if (loginView) loginView.style.display = 'none';
      if (dashboardView) dashboardView.style.display = 'block';
      if (logoutBtn) logoutBtn.style.display = 'inline-flex';
      loadRegistrations();
    } else {
      if (loginView) loginView.style.display = 'grid';
      if (dashboardView) dashboardView.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }

  adminLoginForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = adminPassInput?.value.trim();
    if (pass === ADMIN_PASSCODE || pass === 'admin@solvix') {
      sessionStorage.setItem('solvix_admin_auth', 'true');
      if (loginError) loginError.textContent = '';
      checkAuth();
    } else {
      if (loginError) loginError.textContent = 'Invalid coordinator passcode. Please try again.';
      if (adminPassInput) adminPassInput.value = '';
    }
  });

  logoutBtn?.addEventListener('click', () => {
    sessionStorage.removeItem('solvix_admin_auth');
    checkAuth();
  });

  /* ---- 2. Data Loading & Stats ---- */
  async function loadRegistrations() {
    if (regTableBody) {
      regTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:40px; color:var(--ash);">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite; vertical-align:middle; margin-right:8px;"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
            Loading registrations...
          </td>
        </tr>
      `;
    }

    try {
      allTeams = await fetchAllRegistrations();
      updateStats(allTeams);
      renderTable();
    } catch (err: any) {
      console.error('Error fetching registrations:', err);
      if (regTableBody) {
        regTableBody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; padding:40px; color:#EF4444;">
              Failed to load registrations: ${err?.message || 'Unknown error'}
            </td>
          </tr>
        `;
      }
    }
  }

  function isVerified(t: Team): boolean {
    return t.status === 'approved' || (t.status as string) === 'verified';
  }

  function updateStats(teams: Team[]) {
    const total = teams.length;
    const verified = teams.filter(isVerified).length;
    const pending = teams.filter((t) => t.status === 'pending').length;
    const active = teams.filter((t) => t.status !== 'rejected').length;
    const slots = Math.max(0, 30 - active);

    if (statTotal) statTotal.textContent = String(total);
    if (statSlots) statSlots.textContent = String(slots);
    if (statVerified) statVerified.textContent = String(verified);
    if (statPending) statPending.textContent = String(pending);
    if (statRevenue) statRevenue.textContent = `₹${verified * 299}`;
  }

  /* ---- 3. Render Table ---- */
  function renderTable() {
    if (!regTableBody) return;

    const query = searchInput?.value.trim().toLowerCase() || '';
    const status = statusFilter?.value || 'all';

    const filtered = allTeams.filter((t) => {
      const isTeamVerified = isVerified(t);
      const matchesStatus =
        status === 'all' ||
        (status === 'verified' && isTeamVerified) ||
        t.status === status;

      const college = t.leader_college || t.college_name || '';
      const regId = t.registration_id || t.id || '';
      const matchesQuery =
        !query ||
        t.team_name.toLowerCase().includes(query) ||
        college.toLowerCase().includes(query) ||
        t.leader_name.toLowerCase().includes(query) ||
        regId.toLowerCase().includes(query) ||
        t.transaction_id.toLowerCase().includes(query);

      return matchesStatus && matchesQuery;
    });

    if (filtered.length === 0) {
      regTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:40px; color:var(--ash);">
            No registrations found matching current search / filters.
          </td>
        </tr>
      `;
      return;
    }

    regTableBody.innerHTML = filtered.map((team) => {
      const regId = team.registration_id || team.id;
      const college = team.leader_college || team.college_name || '';
      const phone = team.leader_mobile || team.leader_phone || '';
      const proofUrl = team.payment_screenshot_url || team.payment_proof_url || '';
      const verified = isVerified(team);

      return `
      <tr data-id="${team.id}">
        <td><strong style="font-family:var(--f-mono); font-size:12px; color:var(--violet);">${regId}</strong></td>
        <td>
          <div style="font-weight:600; color:var(--bone);">${escapeHtml(team.team_name)}</div>
          <div style="font-size:12px; color:var(--ash);">${escapeHtml(college)}</div>
        </td>
        <td><span class="chip" style="font-size:11px;">${team.team_size}</span></td>
        <td>
          <div>${escapeHtml(team.leader_name)}</div>
          <div style="font-size:11.5px; font-family:var(--f-mono); color:var(--ash);">${escapeHtml(phone)}</div>
        </td>
        <td><span class="mono" style="font-size:12px;">${escapeHtml(team.transaction_id)}</span></td>
        <td>
          <span class="status-badge ${verified ? 'verified' : team.status}">
            <span class="dot ${verified ? 'dot--live' : ''}" style="${team.status === 'pending' ? 'background:#F59E0B' : team.status === 'rejected' ? 'background:#EF4444' : ''}"></span>
            ${verified ? 'Verified' : team.status}
          </span>
        </td>
        <td>
          ${proofUrl ? `
            <a href="${proofUrl}" target="_blank" rel="noopener" class="action-icon-btn" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
              View Receipt
            </a>
          ` : `<span style="color:var(--ash-dim); font-size:11px;">None</span>`}
        </td>
        <td>
          <div class="action-btn-group">
            <button class="action-icon-btn btn-details" data-id="${team.id}" title="View Details">
              Details
            </button>
            ${!verified ? `
              <button class="action-icon-btn btn-approve" data-id="${team.id}" title="Approve & Verify">
                &check;
              </button>
            ` : ''}
            ${team.status !== 'rejected' ? `
              <button class="action-icon-btn btn-reject" data-id="${team.id}" title="Reject">
                &times;
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
    }).join('');
  }

  function escapeHtml(str: string): string {
    return (str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[m] || m));
  }

  // Filter & Search Events
  searchInput?.addEventListener('input', renderTable);
  statusFilter?.addEventListener('change', renderTable);
  refreshBtn?.addEventListener('click', loadRegistrations);

  /* ---- 4. Actions on Table Items ---- */
  regTableBody?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const approveBtn = target.closest('.btn-approve') as HTMLElement | null;
    const rejectBtn = target.closest('.btn-reject') as HTMLElement | null;
    const detailsBtn = target.closest('.btn-details') as HTMLElement | null;

    if (approveBtn) {
      const id = approveBtn.dataset.id;
      if (!id) return;
      if (confirm(`Verify and approve registration for ${id}?`)) {
        await updateStatus(id, 'approved');
      }
    } else if (rejectBtn) {
      const id = rejectBtn.dataset.id;
      if (!id) return;
      if (confirm(`Reject registration for ${id}?`)) {
        await updateStatus(id, 'rejected');
      }
    } else if (detailsBtn) {
      const id = detailsBtn.dataset.id;
      if (id) showTeamDetails(id);
    }
  });

  async function updateStatus(id: string, status: 'approved' | 'rejected' | 'pending') {
    try {
      await updateTeamStatus(id, status);
      const team = allTeams.find((t) => t.id === id);
      if (team) team.status = status;
      updateStats(allTeams);
      renderTable();
    } catch (err: any) {
      alert(`Failed to update status: ${err?.message}`);
    }
  }

  /* ---- 5. Team Details Modal ---- */
  function showTeamDetails(id: string) {
    const team = allTeams.find((t) => t.id === id);
    if (!team || !detailModal) return;

    const dtRegId = document.getElementById('dtRegId');
    const dtTeamName = document.getElementById('dtTeamName');
    const dtCollege = document.getElementById('dtCollege');
    const dtTxnId = document.getElementById('dtTxnId');
    const dtStatus = document.getElementById('dtStatus');
    const dtMembersList = document.getElementById('dtMembersList');
    const dtPaymentImg = document.getElementById('dtPaymentImg') as HTMLImageElement | null;
    const dtPaymentLink = document.getElementById('dtPaymentLink');
    const dtActionsBar = document.getElementById('dtActionsBar');

    const regId = team.registration_id || team.id;
    const college = team.leader_college || team.college_name || '';
    const proofUrl = team.payment_screenshot_url || team.payment_proof_url || '';
    const verified = isVerified(team);

    if (dtRegId) dtRegId.textContent = regId;
    if (dtTeamName) dtTeamName.textContent = team.team_name;
    if (dtCollege) dtCollege.textContent = `${college} • ${team.team_size} Members`;
    if (dtTxnId) dtTxnId.textContent = team.transaction_id;
    if (dtStatus) {
      dtStatus.innerHTML = `
        <span class="status-badge ${verified ? 'verified' : team.status}">
          <span class="dot ${verified ? 'dot--live' : ''}"></span>
          ${verified ? 'VERIFIED' : team.status.toUpperCase()}
        </span>
      `;
    }

    // Members list: leader first, then members array
    const membersList: Array<{ name: string; email: string; phone: string; year: string; dept: string; id_url: string; is_leader: boolean }> = [
      {
        name: team.leader_name,
        email: team.leader_email,
        phone: team.leader_mobile || team.leader_phone || '',
        year: team.leader_study_year,
        dept: team.leader_department,
        id_url: team.leader_id_card_url,
        is_leader: true,
      }
    ];

    if (team.members && team.members.length > 0) {
      team.members.forEach((m: TeamMember) => {
        const mName = m.member_name || m.name || '';
        if (mName && mName !== team.leader_name) {
          membersList.push({
            name: mName,
            email: m.email,
            phone: m.mobile || m.phone || '',
            year: m.study_year || m.year || '',
            dept: m.department,
            id_url: m.id_card_url,
            is_leader: false,
          });
        }
      });
    }

    if (dtMembersList) {
      dtMembersList.innerHTML = membersList.map((m) => `
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:14px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="display:flex; align-items:center; gap:8px;">
              <strong style="color:var(--bone); font-size:14px;">${escapeHtml(m.name)}</strong>
              ${m.is_leader ? `<span class="chip" style="background:rgba(144,64,237,0.2); color:var(--violet); font-size:10px;">LEADER</span>` : ''}
            </div>
            <div style="font-size:12px; color:var(--ash); margin-top:2px;">
              ${escapeHtml(m.dept)} • ${escapeHtml(m.year)} • <a href="tel:${m.phone}" style="color:var(--bone);">${escapeHtml(m.phone)}</a> • <a href="mailto:${m.email}" style="color:var(--violet);">${escapeHtml(m.email)}</a>
            </div>
          </div>
          <div>
            ${m.id_url ? `
              <a href="${m.id_url}" target="_blank" rel="noopener" class="action-icon-btn" style="text-decoration:none; font-size:11px;">
                View ID Card &rarr;
              </a>
            ` : `<span style="font-size:11px; color:var(--ash-dim);">No ID Uploaded</span>`}
          </div>
        </div>
      `).join('');
    }

    // Payment screenshot
    if (proofUrl) {
      if (dtPaymentImg) {
        dtPaymentImg.src = proofUrl;
        dtPaymentImg.style.display = 'block';
      }
      if (dtPaymentLink) {
        dtPaymentLink.innerHTML = `
          <a href="${proofUrl}" target="_blank" rel="noopener" class="btn btn--ghost btn--sm" style="margin-top:8px;">
            Open Original Image in New Tab &rarr;
          </a>
        `;
      }
    } else {
      if (dtPaymentImg) dtPaymentImg.style.display = 'none';
      if (dtPaymentLink) dtPaymentLink.textContent = 'No payment proof attached.';
    }

    // Action buttons inside modal
    if (dtActionsBar) {
      dtActionsBar.innerHTML = `
        <button class="btn btn--ghost btn--sm" id="modalVerifyBtn" style="color:#10B981; border-color:#10B981;">
          &check; Mark as Verified
        </button>
        <button class="btn btn--ghost btn--sm" id="modalRejectBtn" style="color:#EF4444; border-color:#EF4444;">
          &times; Mark as Rejected
        </button>
      `;

      document.getElementById('modalVerifyBtn')?.addEventListener('click', async () => {
        await updateStatus(team.id, 'approved');
        showTeamDetails(team.id);
      });
      document.getElementById('modalRejectBtn')?.addEventListener('click', async () => {
        await updateStatus(team.id, 'rejected');
        showTeamDetails(team.id);
      });
    }

    detailModal.classList.add('active');
  }

  closeDetailBtn?.addEventListener('click', () => {
    detailModal?.classList.remove('active');
  });

  /* ---- 6. Export to CSV ---- */
  exportCsvBtn?.addEventListener('click', () => {
    if (allTeams.length === 0) {
      alert('No registrations available to export.');
      return;
    }

    const headers = [
      'Registration ID',
      'Team Name',
      'College Name',
      'Team Size',
      'Status',
      'Leader Name',
      'Leader Email',
      'Leader Phone',
      'Member 2 Name',
      'Member 2 Phone',
      'Member 3 Name',
      'Member 3 Phone',
      'Transaction ID',
      'WhatsApp Joined',
      'Created At',
    ];

    const rows = allTeams.map((t) => {
      const regId = t.registration_id || t.id;
      const college = t.leader_college || t.college_name || '';
      const leaderPhone = t.leader_mobile || t.leader_phone || '';
      const members = t.members || [];
      const m2 = members[0] as TeamMember | undefined;
      const m3 = members[1] as TeamMember | undefined;

      const m2Name = m2?.member_name || m2?.name || '';
      const m2Phone = m2?.mobile || m2?.phone || '';
      const m3Name = m3?.member_name || m3?.name || '';
      const m3Phone = m3?.mobile || m3?.phone || '';

      return [
        regId,
        `"${t.team_name.replace(/"/g, '""')}"`,
        `"${college.replace(/"/g, '""')}"`,
        t.team_size,
        t.status,
        `"${t.leader_name.replace(/"/g, '""')}"`,
        t.leader_email,
        leaderPhone,
        `"${m2Name.replace(/"/g, '""')}"`,
        m2Phone,
        `"${m3Name.replace(/"/g, '""')}"`,
        m3Phone,
        `"${t.transaction_id.replace(/"/g, '""')}"`,
        t.whatsapp_joined ? 'Yes' : 'No',
        t.created_at,
      ];
    });

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `SOLVIX26_Registrations_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  });

  /* ---- 7. SQL Setup Modal ---- */
  showSqlBtn?.addEventListener('click', () => {
    if (sqlCodeBlock) sqlCodeBlock.textContent = SUPABASE_SCHEMA_SQL.trim();
    sqlModal?.classList.add('active');
  });

  closeSqlBtn?.addEventListener('click', () => {
    sqlModal?.classList.remove('active');
  });

  copySqlBtn?.addEventListener('click', () => {
    navigator.clipboard?.writeText(SUPABASE_SCHEMA_SQL.trim()).then(() => {
      if (copySqlBtn) {
        copySqlBtn.textContent = 'Copied to Clipboard!';
        setTimeout(() => { copySqlBtn.textContent = 'Copy SQL'; }, 2000);
      }
    });
  });

  // Close modals on background click
  window.addEventListener('click', (e) => {
    if (e.target === detailModal) detailModal.classList.remove('active');
    if (e.target === sqlModal) sqlModal.classList.remove('active');
  });

  checkAuth();
});
