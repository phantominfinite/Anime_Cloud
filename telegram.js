// --- TELEGRAM MINI APP INTEGRATION ---
class TelegramApp {
    static webApp = null; static user = null; static initData = '';
    static init(){
        try{
            if(window.Telegram && window.Telegram.WebApp){
                const app = window.Telegram.WebApp;
                this.webApp = app;
                this.initData = app.initData;
                this.user = app.initDataUnsafe && app.initDataUnsafe.user ? app.initDataUnsafe.user : null;
                if (app.ready) app.ready();
                if (app.expand) app.expand();
                this.applyUserProfile();
                if (app.BackButton){ app.BackButton.hide(); app.BackButton.onClick(()=>{ if (UI.closeModal) UI.closeModal(); }); }
                
                // Attempt Login
                if(this.initData) Auth.login(this.initData);
            }
        }catch(e){console.warn(e);}
    }
    static applyUserProfile(){
        if(!this.user) return;
        const nameEl=document.getElementById('profile-name');
        const av=document.getElementById('profile-avatar');
        const sub=document.getElementById('profile-subtitle');
        if(nameEl) nameEl.textContent = (this.user.first_name||'') + (this.user.last_name?(' '+this.user.last_name):'');
        if(av && this.user.photo_url) av.src=this.user.photo_url;
        if(sub) sub.textContent = this.user.username ? '@'+this.user.username : 'کاربر تلگرام';
    }
    static showBackButton(){ try{ this.webApp?.BackButton?.show(); }catch{} }
    static hideBackButton(){ try{ this.webApp?.BackButton?.hide(); }catch{} }
    static openFileFromTelegram(url){
        try{
            // If it is our internal stream link, use our player
            if (url.startsWith('/api/stream/')) {
                 const fullUrl = window.location.origin + url;
                 App.playVideo('stream', fullUrl, 'پخش ویدیو');
            } else if (this.webApp && typeof this.webApp.openTelegramLink==='function'){ 
                 this.webApp.openTelegramLink(url); 
            } else { 
                 window.open(url, '_blank'); 
            }
        }catch{ window.open(url, '_blank'); }
    }
}
