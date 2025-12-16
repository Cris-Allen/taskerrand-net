import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";
import { api } from "./api.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let currentUser = null;
let userData = null;

// Check user state
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "./index.html";
        return;
    }

    currentUser = user;

    try {
        // Get user data from backend
        userData = await api.getCurrentUser();
        displayUserInfo(user, userData);

        // Show admin link if user is admin
        if (userData.is_admin) {
            const adminLink = document.getElementById("admin-link");
            if (adminLink) {
                adminLink.style.display = "block";
            }
        }

        loadDashboardStats();
        loadMyTasks();
        loadNotifications();
        loadProfileInfo(); // Load profile information after user data is loaded
    } catch (error) {
        console.error("Error loading user data:", error);
        displayUserInfo(user, null);
    }
});

function displayUserInfo(user, userData) {
    const usernameEl = document.getElementById("username");
    const profileEl = document.getElementById("profile");

    if (usernameEl) {
        usernameEl.textContent = `Welcome, ${user.displayName || user.email}!`;
    }

    if (profileEl) {
        profileEl.src = user.photoURL || "";
        profileEl.alt = user.displayName || "Profile";
    }
}

async function loadProfileInfo() {
    try {
        // Show loading indicator
        const loadingEl = document.getElementById("loading-profile");
        const formEl = document.getElementById("profile-form");

        if (loadingEl) loadingEl.style.display = "block";
        if (formEl) formEl.style.display = "none";

        // Get user profile data from the backend
        const profileResponse = await fetch('/api/users/me', {
            headers: {
                'Authorization': `Bearer ${await api.getToken()}`,
                'Content-Type': 'application/json'
            }
        });

        if (!profileResponse.ok) {
            throw new Error(`Failed to load profile: ${profileResponse.statusText}`);
        }

        const profileData = await profileResponse.json();

        // Populate the profile form
        const fullNameInput = document.getElementById("full-name");
        const addressInput = document.getElementById("address");

        if (fullNameInput) {
            // Use the name from the profile data, combining first and last name if available
            const fullName = profileData.name || `${profileData.first_name || ''} ${profileData.last_name || ''}`.trim();
            fullNameInput.value = fullName;
        }

        if (addressInput) {
            addressInput.value = profileData.address || '';
        }

        // Hide loading, show form
        if (loadingEl) loadingEl.style.display = "none";
        if (formEl) formEl.style.display = "block";

        // Add event listener for form submission
        const profileForm = document.getElementById("profile-form");
        if (profileForm) {
            profileForm.onsubmit = handleProfileUpdate;
        }
    } catch (error) {
        console.error("Error loading profile:", error);
        const loadingEl = document.getElementById("loading-profile");
        if (loadingEl) {
            loadingEl.textContent = `Error loading profile: ${error.message}`;
            loadingEl.style.color = "red";
        }
    }
}

async function handleProfileUpdate(event) {
    event.preventDefault(); // Prevent default form submission

    try {
        const fullNameInput = document.getElementById("full-name");
        const addressInput = document.getElementById("address");
        const messageEl = document.getElementById("profile-message");

        // Get the values
        const fullName = fullNameInput.value.trim();
        const address = addressInput.value.trim();

        // Basic validation
        if (!fullName) {
            showMessage("Please enter your full name", "error");
            return;
        }

        if (fullName.length < 2 || fullName.length > 100) {
            showMessage("Name must be between 2 and 100 characters", "error");
            return;
        }

        if (address && (address.length < 5 || address.length > 200)) {
            showMessage("Address must be between 5 and 200 characters if provided", "error");
            return;
        }

        // Prepare the profile data - split full name into first and last name
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const profileData = {
            first_name: firstName,
            last_name: lastName,
            name: fullName,
            address: address
        };

        // Update the profile via API
        const response = await fetch('/api/users/me/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${await api.getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to update profile');
        }

        const updatedData = await response.json();

        // Update the user data in the global variable
        userData = updatedData;

        // Update the welcome message with the new name
        const usernameEl = document.getElementById("username");
        if (usernameEl) {
            usernameEl.textContent = `Welcome, ${updatedData.name || updatedData.email}!`;
        }

        showMessage("Profile updated successfully!", "success");
    } catch (error) {
        console.error("Error updating profile:", error);
        showMessage(`Error updating profile: ${error.message}`, "error");
    }
}

function showMessage(message, type) {
    const messageEl = document.getElementById("profile-message");
    if (!messageEl) return;

    messageEl.textContent = message;
    messageEl.style.display = "block";

    if (type === "success") {
        messageEl.style.backgroundColor = "#d4edda";
        messageEl.style.color = "#155724";
        messageEl.style.border = "1px solid #c3e6cb";

        // Auto-hide success message after 3 seconds
        setTimeout(() => {
            messageEl.style.display = "none";
        }, 3000);
    } else {
        messageEl.style.backgroundColor = "#f8d7da";
        messageEl.style.color = "#721c24";
        messageEl.style.border = "1px solid #f5c6cb";
    }
}

async function loadDashboardStats() {
    try {
        const tasks = await api.getMyTasks();

        const stats = {
            posted: tasks.filter(t => t.poster_id === userData.id).length,
            accepted: tasks.filter(t => t.seeker_id === userData.id).length,
            completed: tasks.filter(t => t.status === "completed" && t.seeker_id === userData.id).length,
            active: tasks.filter(t => t.status === "ongoing" || t.status === "pending_confirmation").length
        };

        const statsContainer = document.getElementById("stats");
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3>${stats.posted}</h3>
                        <p>Tasks Posted</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.accepted}</h3>
                        <p>Tasks Accepted</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.completed}</h3>
                        <p>Tasks Completed</p>
                    </div>
                    <div class="stat-card">
                        <h3>${stats.active}</h3>
                        <p>Active Tasks</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error("Error loading stats:", error);
    }
}

async function loadMyTasks() {
    return loadMyTasksWithFilter(null);
}

async function loadMyTasksWithFilter(statusFilter = null) {
    try {
        const tasks = await api.getMyTasks();
        const tasksContainer = document.getElementById("my-tasks");
        // Apply client-side status filter if provided
        const filteredTasks = statusFilter ? tasks.filter(t => t.status === statusFilter) : tasks;

        if (tasksContainer) {
            if (filteredTasks.length === 0) {
                tasksContainer.innerHTML = `
                    <div class="empty-state">
                        <p>No tasks match the selected filter.</p>
                    </div>
                `;
                return;
            }

            // Fetch poster names and render tasks with creator shown
            const rendered = await Promise.all(filteredTasks.map(async (task) => {
                let posterName = 'Unknown';
                try { const u = await api.getUser(task.poster_id); posterName = u.name || u.email || posterName; } catch (e) { }
                return `
                <div class="task-card" onclick="window.location.href='./task-detail.html?id=${task.id}'">
                    <a></a>
                    <h3>Task: ${task.title}</h3>
                    <div class="task-creator">Created by: ${posterName}</div>
                    <p>Description: ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}</p>
                    <div class="task-meta">
                        <span style="display: block" class="task-status status-${task.status}">Status: ${task.status.replace('_', ' ')}</span>
                        <span><strong>Payment: ₱${task.payment.toFixed(2)}</strong></span>
                    </div>
                    <a></a>
                </div>
            `;
            }));

            tasksContainer.innerHTML = rendered.join('');
        }
    } catch (error) {
        console.error("Error loading tasks:", error);
    }
}

window.filterMyTasks = function () {
    const filter = document.getElementById('my-task-filter').value;
    loadMyTasksWithFilter(filter || null);
};

// Logout button event
const logoutBtn = document.getElementById("google-logout-btn-id");
if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
        signOut(auth).then(() => {
            window.location.href = "./index.html";
        });
    });
}

// Notification Logic
async function loadNotifications() {
    // Helper: ensure backend naive datetimes are treated as UTC when parsing in the browser
    function formatNotificationDate(dateStr) {
        if (!dateStr) return '';
        // If string already contains timezone info (Z or ±HH:MM), parse directly
        if (/[Zz]|[+\-]\d{2}:\d{2}$/.test(dateStr)) {
            return new Date(dateStr).toLocaleString();
        }
        // Otherwise, assume UTC and append Z
        try { return new Date(dateStr + 'Z').toLocaleString(); } catch (e) { return new Date(dateStr).toLocaleString(); }
    }
    try {
        const notifications = await api.getNotifications();
        const notificationList = document.getElementById("notification-list");
        const notificationBadge = document.getElementById("notification-badge");

        if (!notificationList) return;

        // Update badge
        const unreadCount = notifications.filter(n => !n.seen).length;
        if (notificationBadge) {
            notificationBadge.textContent = unreadCount;
            notificationBadge.style.display = unreadCount > 0 ? "block" : "none";
        }

        if (notifications.length === 0) {
            notificationList.innerHTML = '<div class="notification-empty">No notifications</div>';
            return;
        }

        notificationList.innerHTML = notifications.map(n => `
            <div class="notification-item ${n.seen ? '' : 'unread'}">
                <div class="notification-title">${n.title}</div>
                <div class="notification-message">${n.message}</div>
                <div class="notification-time">${formatNotificationDate(n.created_at)}</div>
                <div class="notification-actions" onclick="event.stopPropagation();">
                    ${n.task_id ? `<button class="notification-view-btn" onclick="handleNotificationView(${n.id}, ${n.task_id}, ${n.seen}, event)">View</button>` : ''}
                    <button class="notification-delete-btn" onclick="handleNotificationDelete(${n.id}, event)">Delete</button>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error("Error loading notifications:", error);
    }
}

window.handleNotificationView = async function (notificationId, taskId, seen, event) {
    try {
        // Mark as read if not already read
        if (!seen) {
            await api.markNotificationRead(notificationId);
        }

        // Close the notification dropdown
        const dropdown = document.getElementById("notification-dropdown");
        if (dropdown) {
            dropdown.classList.remove("show");
        }

        // Check if Ctrl or Cmd key was pressed
        if (event.ctrlKey || event.metaKey) {
            // Open in new tab
            window.open(`./task-detail.html?id=${taskId}`, '_blank');
        } else {
            // Navigate in current tab
            window.location.href = `./task-detail.html?id=${taskId}`;
        }
    } catch (error) {
        console.error("Error handling notification view:", error);
    }
};

window.handleNotificationDelete = async function (notificationId, event) {
    try {
        event.stopPropagation();

        // Delete the notification
        await api.deleteNotification(notificationId);

        // Reload notifications to reflect the deletion
        loadNotifications();
    } catch (error) {
        console.error("Error deleting notification:", error);
    }
};

// Notification bell event listener
document.addEventListener("DOMContentLoaded", () => {
    const bell = document.getElementById("notification-bell");
    const dropdown = document.getElementById("notification-dropdown");

    if (bell && dropdown) {
        bell.addEventListener("click", (e) => {
            e.stopPropagation();
            dropdown.classList.toggle("show");
        });

        // Close dropdown when clicking outside
        window.addEventListener("click", () => {
            if (dropdown.classList.contains("show")) {
                dropdown.classList.remove("show");
            }
        });

        dropdown.addEventListener("click", (e) => {
            e.stopPropagation();
        });
    }
});

