/**
 * ============================================================================
 * SASI PORTFOLIO — SUPABASE REAL-TIME CLOUD CLIENT & SINGLE SOURCE OF TRUTH
 * Primary database connector for Supabase PostgreSQL, Storage, and Realtime
 * ============================================================================
 */

(function () {
  const SUPABASE_URL = "https://bmpocwigcbyohmlleygw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_I3qyhkDSKsjv3WGYaGlv1w_5sxZVX4Y";

  let client = null;
  let liveChannel = null;
  const activeListeners = new Set();

  function getClient() {
    if (!client && typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
      try {
        client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });
      } catch (err) {
        console.warn('[Supabase] Init notice:', err.message);
      }
    }
    return client;
  }

  function getRealtimeChannel() {
    const sb = getClient();
    if (!sb) return null;
    if (!liveChannel) {
      try {
        liveChannel = sb.channel('sasi_live_updates', {
          config: { broadcast: { self: false } }
        });

        liveChannel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('[Supabase Realtime] Connected to live channel');
            const pill = document.getElementById('live-sync-indicator') || document.getElementById('admin-live-pill');
            if (pill) {
              const txt = pill.querySelector('span:not(.live-dot)') || document.getElementById('live-sync-text') || document.getElementById('admin-live-status-text');
              if (txt) txt.textContent = '🟢 Real-Time Cloud Live: Active';
            }
          }
        });
      } catch (err) {
        console.warn('[Supabase] Channel notice:', err.message);
      }
    }
    return liveChannel;
  }

  const SasiSupabase = {
    url: SUPABASE_URL,
    key: SUPABASE_KEY,
    getClient,

    /**
     * Broadcast an update immediately across open tabs and global devices
     */
    broadcast: async function (eventType, payload) {
      // 1. Cross-tab Local BroadcastChannel
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('sasi_live_updates');
          bc.postMessage({ type: eventType, payload });
          setTimeout(() => { try { bc.close(); } catch (e) {} }, 500);
        }
      } catch (e) {}

      // 2. Storage event fallback
      try {
        localStorage.setItem('SASI_LIVE_UPDATE_EVENT', JSON.stringify({
          type: eventType,
          payload,
          timestamp: Date.now()
        }));
      } catch (e) {}

      // 3. Supabase Cloud Realtime Broadcast
      try {
        const ch = getRealtimeChannel();
        if (ch) {
          await ch.send({
            type: 'broadcast',
            event: eventType,
            payload: payload
          });
        }
      } catch (err) {
        console.warn('[Supabase] Broadcast notice:', err.message);
      }
    },

    /**
     * Listen for real-time updates with clean listener management & deduplication
     */
    listen: function (callback) {
      if (typeof callback !== 'function' || activeListeners.has(callback)) return;
      activeListeners.add(callback);

      // 1. BroadcastChannel
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('sasi_live_updates');
          bc.onmessage = (e) => {
            if (e.data && activeListeners.has(callback)) callback(e.data);
          };
        }
      } catch (e) {}

      // 2. Storage event
      window.addEventListener('storage', (e) => {
        if (e.key === 'SASI_LIVE_UPDATE_EVENT' && e.newValue && activeListeners.has(callback)) {
          try {
            const data = JSON.parse(e.newValue);
            callback(data);
          } catch (err) {}
        }
      });

      // 3. Supabase Cloud Realtime listener
      try {
        const ch = getRealtimeChannel();
        if (ch) {
          const events = ['settings_updated', 'theme_updated', 'sections_updated', 'content_updated', 'media_updated', 'full_refresh'];
          events.forEach(evt => {
            ch.on('broadcast', { event: evt }, (response) => {
              if (response && response.payload && activeListeners.has(callback)) {
                callback({ type: evt, payload: response.payload });
              }
            });
          });

          // PostgreSQL change events for public settings
          ch.on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio_settings' }, (change) => {
            if (change.new && change.new.key && activeListeners.has(callback)) {
              const single = {};
              single[change.new.key] = change.new.value;
              callback({ type: 'settings_updated', payload: single });
            }
          });
        }
      } catch (err) {
        console.warn('[Supabase] Listen notice:', err.message);
      }

      // Return cleanup function
      return function unlisten() {
        activeListeners.delete(callback);
      };
    },

    /**
     * Submit contact inquiry securely to Supabase contact_inquiries table
     */
    submitContactInquiry: async function (data) {
      const sb = getClient();
      if (!sb) return { success: false, message: 'Cloud database client not initialized' };

      const name = String(data.name || '').trim();
      const email = String(data.email || '').trim();
      const message = String(data.message || '').trim();
      const phone = String(data.phone || '').trim();
      const subject = String(data.subject || 'Portfolio Inquiry').trim();

      if (name.length < 2) return { success: false, message: 'Please enter a valid name' };
      if (!email.includes('@') || email.length < 5) return { success: false, message: 'Please enter a valid email address' };
      if (message.length < 5) return { success: false, message: 'Message must be at least 5 characters long' };

      try {
        const { error } = await sb
          .from('contact_inquiries')
          .insert([{ name, email, phone, subject, message, status: 'unread' }]);

        if (error) {
          console.warn('[Supabase] Contact inquiry insert notice:', error.message);
          return { success: false, message: error.message };
        }

        return { success: true, message: 'Your message has been sent successfully! Sasikumar will review it shortly.' };
      } catch (err) {
        return { success: false, message: err.message || 'Network error delivering message' };
      }
    },

    /**
     * Save settings to Supabase cloud database
     */
    saveSettings: async function (settingsObj) {
      const sb = getClient();
      if (!sb) return false;

      try {
        const rows = Object.entries(settingsObj).map(([key, value]) => ({
          key: String(key),
          value: typeof value === 'object' ? JSON.stringify(value) : String(value),
          updated_at: new Date().toISOString()
        }));

        const { error } = await sb
          .from('portfolio_settings')
          .upsert(rows, { onConflict: 'key' });

        if (error) {
          console.warn('[Supabase] Save settings notice:', error.message);
          return false;
        }

        return true;
      } catch (err) {
        return false;
      }
    },

    /**
     * Fetch settings from Supabase cloud database
     */
    loadSettings: async function () {
      const sb = getClient();
      if (!sb) return null;

      try {
        const { data, error } = await sb
          .from('portfolio_settings')
          .select('key, value');

        if (error || !data || data.length === 0) return null;

        const result = {};
        data.forEach(r => {
          result[r.key] = r.value;
        });
        return result;
      } catch (err) {
        return null;
      }
    },

    /**
     * Load published portfolio projects from Supabase
     */
    loadProjects: async function () {
      const sb = getClient();
      if (!sb) return null;

      try {
        const { data, error } = await sb
          .from('portfolio_projects')
          .select('*')
          .eq('status', 'published')
          .order('sort_order', { ascending: true });

        if (error || !data) return null;
        return data;
      } catch (err) {
        return null;
      }
    },

    /**
     * Load visible sections from Supabase
     */
    loadSections: async function () {
      const sb = getClient();
      if (!sb) return null;

      try {
        const { data, error } = await sb
          .from('sections')
          .select('*')
          .eq('is_visible', true)
          .order('sort_order', { ascending: true });

        if (error || !data) return null;
        return data;
      } catch (err) {
        return null;
      }
    },

    /**
     * Load published theme from Supabase
     */
    loadTheme: async function () {
      const sb = getClient();
      if (!sb) return null;

      try {
        const { data, error } = await sb
          .from('themes')
          .select('*')
          .eq('is_draft', false)
          .limit(1)
          .maybeSingle();

        if (error || !data) return null;
        return data;
      } catch (err) {
        return null;
      }
    },

    /**
     * Upload asset to Supabase Storage bucket
     */
    uploadStorageFile: async function (file, bucketName = 'portfolio-media') {
      const sb = getClient();
      if (!sb) return { success: false, message: 'Supabase client unavailable' };

      try {
        const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${Date.now()}_${cleanName}`;

        const { data, error } = await sb.storage
          .from(bucketName)
          .upload(filePath, file, { cacheControl: '3600', upsert: false });

        if (error) return { success: false, message: error.message };

        const { data: publicUrlData } = sb.storage.from(bucketName).getPublicUrl(filePath);
        return {
          success: true,
          url: publicUrlData.publicUrl,
          path: filePath,
          name: cleanName
        };
      } catch (err) {
        return { success: false, message: err.message };
      }
    }
  };

  window.SasiSupabase = SasiSupabase;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => SasiSupabase.getClient());
    } else {
      SasiSupabase.getClient();
    }
  }
})();
