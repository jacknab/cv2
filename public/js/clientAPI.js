class ClientAPI {
    static async checkAuth() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/login';
            return null;
        }

        try {
            const response = await fetch('/api/auth/verify', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Auth failed');
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Auth check failed:', error);
            localStorage.removeItem('token');
            window.location.href = '/login';
            return null;
        }
    }

    static updateUserInfo(user) {
        if (user) {
            document.getElementById('username').textContent = user.username;
            // Add more user info updates as needed
        }
    }
}