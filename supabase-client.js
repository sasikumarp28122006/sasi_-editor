/**
 * ============================================================================
 * SASI PORTFOLIO — SUPABASE REAL-TIME CLOUD CLIENT
 * Bridges LocalStorage, SQLite Backend, and Supabase Cloud for Zero-Latency Live Updates
 * ============================================================================
 */

(function () {
  const SUPABASE_URL = "https://bmpocwigcbyohmlleygw.supabase.co";
  const SUPABASE_KEY = "sb_publishable_I3qyhkDSKsjv3WGYaGlv1w_5sxZVX4Y";

  let client = null;
  let liveChannel = null;

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
     * Broadcast an update immediately to all connected devices across the globe
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

      // 2. Storage event
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
          console.log('[Supabase] Broadcasted event:', eventType);
        }
      } catch (err) {
        console.warn('[Supabase] Broadcast notice:', err.message);
      }
    },

    /**
     * Listen for real-time updates from other devices / admin dashboard
     */
    listen: function (callback) {
      // 1. BroadcastChannel
      try {
        if ('BroadcastChannel' in window) {
          const bc = new BroadcastChannel('sasi_live_updates');
          bc.onmessage = (e) => {
            if (e.data) callback(e.data);
          };
        }
      } catch (e) {}

      // 2. Storage event
      window.addEventListener('storage', (e) => {
        if (e.key === 'SASI_LIVE_UPDATE_EVENT' && e.newValue) {
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
          ['settings_updated', 'theme_updated', 'sections_updated', 'content_updated', 'media_updated', 'full_refresh'].forEach(evt => {
            ch.on('broadcast', { event: evt }, (response) => {
              if (response && response.payload) {
                callback({ type: evt, payload: response.payload });
              }
            });
          });

          // Also listen to PostgreSQL change events on portfolio_settings table
          ch.on('postgres_changes', { event: '*', schema: 'public', table: 'portfolio_settings' }, (change) => {
            if (change.new && change.new.key) {
              const single = {};
              single[change.new.key] = change.new.value;
              callback({ type: 'settings_updated', payload: single });
            }
          });
        }
      } catch (err) {
        console.warn('[Supabase] Listen notice:', err.message);
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
          console.warn('[Supabase] Could not save to table (run supabase_schema.sql):', error.message);
          return false;
        }

        console.log('[Supabase] Settings successfully persisted to cloud database!');
        return true;
      } catch (err) {
        console.warn('[Supabase] Save error:', err.message);
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
    }
  };

  window.SasiSupabase = SasiSupabase;

  // Initialize channel when DOM is ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => SasiSupabase.getClient());
    } else {
      SasiSupabase.getClient();
    }
  }
})();
