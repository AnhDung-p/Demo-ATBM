/** Lưu & đọc “CSDL giả” người dùng trong localStorage */
function getUsers() {
  return JSON.parse(localStorage.getItem('users') || '{}');
}
function setUsers(users) {
  localStorage.setItem('users', JSON.stringify(users));
}

/** Phiên đăng nhập: currentUser = { email, fullname } */
function getCurrentUser() {
  const raw = localStorage.getItem('currentUser');
  return raw ? JSON.parse(raw) : null;
}
function setCurrentUser(userObj) {
  localStorage.setItem('currentUser', JSON.stringify(userObj));
}
function clearCurrentUser() {
  localStorage.removeItem('currentUser');
}

/** Bảo vệ trang chủ nếu cần (ví dụ muốn bắt buộc login) */
function requireLogin(redirectIfNot = 'login.html') {
  if (!getCurrentUser()) {
    window.location.href = redirectIfNot;
  }
}
