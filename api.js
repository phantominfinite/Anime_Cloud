// --- AUTH MODULE ---
class Auth {
    static token = null;
    static user = null;
    static library = [];

    static async login(initData) {
        try {
            const res = await fetch(`${CONFIG.tgApiBase}/auth/login`, {
                method: 'POST',
                headers: {'X-Telegram-Init-Data': initData}
            });
            if (res.ok) {
                const json = await res.json();
                if (json.ok) {
                    this.token = initData;
                    this.user = json.user;
                    UI.showToast('خوش آمدید', `${this.user.first_name} عزیز، همگام‌سازی انجام شد.`);
                    await this.syncLibrary();
                }
            }
        } catch (e) { console.error('Login failed', e); }
    }

    static async syncLibrary() {
        if (!this.token) return;
        try {
            const res = await fetch(`${CONFIG.tgApiBase}/user/library`, {
                headers: {'X-Telegram-Init-Data': this.token}
            });
            const json = await res.json();
            if (json.ok) {
                this.library = json.library;
                // Refresh views if needed
            }
        } catch(e) { console.error(e); }
    }

    static async updateAnime(malId, data) {
            if (!this.token) return; // Fallback to local storage handled by Storage class wrapper if needed
            try {
            await fetch(`${CONFIG.tgApiBase}/user/library/${malId}`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'X-Telegram-Init-Data': this.token},
                body: JSON.stringify(data)
            });
            await this.syncLibrary();
            } catch(e) { console.error(e); }
    }
}

// --- API MODULE ---

class API {
    static async getTgEpisodes(malId){
        try{
            const base = CONFIG.tgApiBase.replace(/\/$/,'');
            const res = await fetch(`${base}/anime/${malId}/episodes`);
            if(!res.ok) return [];
            const json = await res.json();
            return Array.isArray(json) ? json : [];
        }catch(e){
            console.warn('TG API error', e);
            return [];
        }
    }

    static async getTgStats(){
        try{
            const base = CONFIG.tgApiBase.replace(/\/$/,'');
            const res = await fetch(`${base}/stats`);
            if(!res.ok) return null;
            const json = await res.json();
            return json;
        }catch(e){
            console.warn('TG stats error', e);
            return null;
        }
    }

    static async checkSystemHealth() {
        try {
            const base = CONFIG.tgApiBase.replace(/\/$/,'');
            const res = await fetch(`${base}/system/health`);
            if (!res.ok) throw new Error();
            return await res.json();
        } catch { return null; }
    }

    static async get(endpoint, retries = 2) {
        try {
            const res = await fetch(`${CONFIG.apiBase}${endpoint}`);
            if (!res.ok) {
                if (res.status === 429 && retries > 0) { // Rate limit
                    await new Promise(r => setTimeout(r, 1200));
                    return this.get(endpoint, retries - 1);
                }
                throw new Error(`API Error: ${res.status}`);
            }
            const json = await res.json();
            return json.data;
        } catch (err) {
            console.error(err);
            return null;
        }
    }
    static async getInternal(endpoint, options = {}) {
        try {
                const res = await fetch(`${CONFIG.tgApiBase}${endpoint}`, options);
                return await res.json();
        } catch(e) { console.error(e); return null; }
    }
    static async getSeasonNow() { return this.get('/seasons/now?limit=6'); }
    static async getTrending() { return this.get('/top/anime?filter=airing&limit=10'); }
    static async getTop(page = 1, filter = 'bypopularity') { return this.get(`/top/anime?filter=${filter}&page=${page}&limit=20`); }
    static async getDetails(id) { return this.get(`/anime/${id}/full`); }
    static async getCharacters(id) { return this.get(`/anime/${id}/characters`); }
    static async getRecommendations(id) { return this.get(`/anime/${id}/recommendations`); }
    static async getRandom() { return this.get('/random/anime'); }
    static async getSchedule() { return this.get('/schedules'); }
    static async search(query, filters = {}) {
        let url = `/anime?q=${encodeURIComponent(query)}&sfw`;
        if(filters.status) url += `&status=${filters.status}`;
        if(filters.type) url += `&type=${filters.type}`;
        return this.get(url);
    }
}
