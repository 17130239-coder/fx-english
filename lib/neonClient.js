/**
 * FX English - Neon Serverless Database Client
 * Dual-mode database persistence:
 * 1. Default (Zero-config & Zero key leak): Securely routes via FX English Webapp Cloud API (https://fx-english-webapp.vercel.app/api)
 * 2. Direct HTTPS /sql: When custom NEON_DATABASE_URL is provided in storage or environment.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const client = factory();
    root.APP_NEON_CLIENT = client;
    root.neonClient = client;
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DEFAULT_CONFIG = {
    DB_URL: (typeof process !== 'undefined' && process.env?.NEON_DATABASE_URL) || '',
    PROJECT_ID: (typeof process !== 'undefined' && process.env?.NEON_PROJECT_ID) || '',
    HOST: (typeof process !== 'undefined' && process.env?.NEON_HOST) || '',
    API_BASE: 'https://fx-english-webapp.vercel.app/api'
  };

  class NeonStorageClient {
    constructor() {
      this.dbUrl = DEFAULT_CONFIG.DB_URL;
      this.projectId = DEFAULT_CONFIG.PROJECT_ID;
      this.host = DEFAULT_CONFIG.HOST;
      this.apiBase = DEFAULT_CONFIG.API_BASE;
      this.endpoint = this.host ? `https://${this.host}/sql` : '';
      if (this.dbUrl) {
        this.initUrl(this.dbUrl);
      }
    }

    /**
     * Parse connection string and set up HTTPS /sql endpoint.
     * @param {string} url
     */
    initUrl(url) {
      this.dbUrl = (url && String(url).trim()) || '';
      if (!this.dbUrl) {
        this.host = '';
        this.endpoint = '';
        return;
      }
      try {
        const normalized = this.dbUrl.replace(/^postgres(ql)?:\/\//i, 'http://');
        const parsed = new URL(normalized);
        this.host = parsed.host || '';
        this.endpoint = this.host ? `https://${this.host}/sql` : '';
      } catch (e) {
        this.host = '';
        this.endpoint = '';
      }
    }

    /**
     * Asynchronously loads custom Neon configuration if configured by user in storage.
     */
    async loadConfig() {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['neonDatabaseUrl', 'neonApiBase'], (res) => {
            if (res && res.neonDatabaseUrl) {
              this.initUrl(res.neonDatabaseUrl);
            }
            if (res && res.neonApiBase) {
              this.apiBase = String(res.neonApiBase).replace(/\/+$/, '');
            }
            resolve(this.dbUrl);
          });
        } else {
          resolve(this.dbUrl);
        }
      });
    }

    /**
     * Direct HTTPS query to Neon /sql serverless endpoint.
     * @param {string} sql
     * @param {Array<any>} params
     * @returns {Promise<Array<any>>}
     */
    async queryDirect(sql, params = []) {
      await this.loadConfig();

      if (!this.dbUrl || !this.endpoint) {
        throw new Error('Neon DB URL is not configured for direct raw SQL queries. Use high-level methods (getMovies, saveMovie, etc.) to sync via secure Cloud API.');
      }

      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Neon-Connection-String': this.dbUrl
        },
        body: JSON.stringify({ query: sql, params })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        let errMsg = `Neon HTTP Error (${res.status})`;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.message) errMsg = errJson.message;
        } catch (e) {
          if (errText) errMsg += `: ${errText}`;
        }
        throw new Error(errMsg);
      }

      const data = await res.json();
      return data.rows || [];
    }

    /**
     * Unified Query Method.
     * In web page content scripts (if ever used), proxies via background worker to bypass page CSP.
     * Everywhere else (background worker, studio, popup, node tests), direct HTTPS is used.
     * @param {string} sql
     * @param {Array<any>} params
     * @returns {Promise<Array<any>>}
     */
    async query(sql, params = []) {
      const isContentScript =
        typeof window !== 'undefined' &&
        typeof window.location !== 'undefined' &&
        (window.location.protocol === 'http:' || window.location.protocol === 'https:');

      if (isContentScript && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ action: 'neon_query', sql, params }, (res) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!res || !res.success) {
              reject(new Error(res?.error || 'No response from Neon background worker'));
            } else {
              resolve(res.rows || []);
            }
          });
        });
      }

      return this.queryDirect(sql, params);
    }

    /**
     * Initialize Neon table schema if not already present.
     */
    async initSchema() {
      if (!this.dbUrl) {
        return true;
      }

      await this.query(`
        CREATE TABLE IF NOT EXISTS fx_scanned_movies (
          id VARCHAR(100) PRIMARY KEY,
          title TEXT NOT NULL,
          platform VARCHAR(50) DEFAULT 'file',
          url TEXT DEFAULT '',
          timestamp BIGINT NOT NULL,
          date_formatted TEXT,
          word_count INT DEFAULT 0,
          noun_count INT DEFAULT 0,
          verb_count INT DEFAULT 0,
          adj_count INT DEFAULT 0,
          adv_count INT DEFAULT 0,
          cues JSONB DEFAULT '[]'::jsonb,
          analysis JSONB DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await this.query(`
        CREATE TABLE IF NOT EXISTS fx_master_known_list (
          id VARCHAR(100) PRIMARY KEY,
          text TEXT NOT NULL UNIQUE,
          type VARCHAR(50) DEFAULT 'word',
          pos VARCHAR(20) DEFAULT 'N',
          known_meanings JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);

      await this.query(`CREATE INDEX IF NOT EXISTS idx_fx_scanned_movies_timestamp ON fx_scanned_movies (timestamp DESC);`).catch(() => {});
      await this.query(`CREATE INDEX IF NOT EXISTS idx_fx_scanned_movies_platform ON fx_scanned_movies (platform);`).catch(() => {});
      await this.query(`CREATE INDEX IF NOT EXISTS idx_fx_scanned_movies_title ON fx_scanned_movies (title);`).catch(() => {});
      await this.query(`CREATE INDEX IF NOT EXISTS idx_fx_master_known_list_text ON fx_master_known_list (text);`).catch(() => {});
      return true;
    }

    /**
     * Map database row to standard scanned movie history item.
     * Supports both direct Postgres snake_case and Cloud API camelCase.
     * @param {Object} row
     */
    mapRow(row) {
      if (!row) return null;

      let cues = [];
      if (row.cues) {
        try {
          cues = typeof row.cues === 'string' ? JSON.parse(row.cues) : row.cues;
        } catch (e) {
          cues = [];
        }
      }

      let analysis = null;
      if (row.analysis) {
        try {
          analysis = typeof row.analysis === 'string' ? JSON.parse(row.analysis) : row.analysis;
        } catch (e) {
          analysis = null;
        }
      }

      return {
        id: String(row.id),
        title: String(row.title || 'Không tên'),
        platform: String(row.platform || 'file'),
        url: String(row.url || ''),
        timestamp: Number(row.timestamp) || Date.now(),
        dateFormatted: String(row.dateFormatted || row.date_formatted || ''),
        wordCount: Number(row.wordCount != null ? row.wordCount : row.word_count) || 0,
        nounCount: Number(row.nounCount != null ? row.nounCount : row.noun_count) || 0,
        verbCount: Number(row.verbCount != null ? row.verbCount : row.verb_count) || 0,
        adjCount: Number(row.adjCount != null ? row.adjCount : row.adj_count) || 0,
        advCount: Number(row.advCount != null ? row.advCount : row.adv_count) || 0,
        cues: Array.isArray(cues) ? cues : [],
        analysis: analysis,
        createdAt: row.createdAt || row.created_at,
        updatedAt: row.updatedAt || row.updated_at
      };
    }

    /**
     * Insert or update a scanned movie and its full vocabulary analysis in Neon.
     * @param {Object} item
     */
    async saveMovie(item) {
      if (!item || !item.title) return null;
      await this.loadConfig();

      const id = String(item.id || `scan_${item.timestamp || Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
      const title = String(item.title).trim();
      const platform = String(item.platform || 'file');
      const url = String(item.url || '');
      const timestamp = Number(item.timestamp) || Date.now();
      const dateFormatted = String(item.dateFormatted || new Date(timestamp).toLocaleDateString('vi-VN'));
      const wordCount = Number(item.wordCount || (item.analysis?.totals?.uniqueWords) || 0);
      const nounCount = Number(item.nounCount || (item.analysis?.categories?.noun?.count) || 0);
      const verbCount = Number(item.verbCount || (item.analysis?.categories?.verb?.count) || 0);
      const adjCount = Number(item.adjCount || (item.analysis?.categories?.adjective?.count) || 0);
      const advCount = Number(item.advCount || (item.analysis?.categories?.adverb?.count) || 0);

      if (this.dbUrl) {
        const cues = item.cues ? JSON.stringify(item.cues) : '[]';
        const analysis = item.analysis ? JSON.stringify(item.analysis) : '{}';

        const sql = `
          INSERT INTO fx_scanned_movies (
            id, title, platform, url, timestamp, date_formatted,
            word_count, noun_count, verb_count, adj_count, adv_count,
            cues, analysis, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, NOW())
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            platform = EXCLUDED.platform,
            url = EXCLUDED.url,
            timestamp = EXCLUDED.timestamp,
            date_formatted = EXCLUDED.date_formatted,
            word_count = EXCLUDED.word_count,
            noun_count = EXCLUDED.noun_count,
            verb_count = EXCLUDED.verb_count,
            adj_count = EXCLUDED.adj_count,
            adv_count = EXCLUDED.adv_count,
            cues = EXCLUDED.cues,
            analysis = EXCLUDED.analysis,
            updated_at = NOW()
          RETURNING *;
        `;

        const rows = await this.query(sql, [
          id,
          title,
          platform,
          url,
          timestamp,
          dateFormatted,
          wordCount,
          nounCount,
          verbCount,
          adjCount,
          advCount,
          cues,
          analysis
        ]);

        return this.mapRow(rows[0]);
      }

      // API mode via Cloud backend
      const payload = {
        id,
        title,
        platform,
        url,
        timestamp,
        dateFormatted,
        wordCount,
        nounCount,
        verbCount,
        adjCount,
        advCount,
        cues: item.cues || [],
        analysis: item.analysis || {}
      };

      const res = await fetch(`${this.apiBase}/movies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Neon API Error (${res.status}): ${errText}`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to save movie to Neon');
      }

      return this.mapRow({
        ...payload,
        id: data.movie?.id || id,
        title: data.movie?.title || title
      });
    }

    /**
     * Fetch scanned movies from Neon.
     * When includeDetails is false (default for history lists), omits heavy JSONB cues and analysis columns
     * to avoid downloading dozens of megabytes over the network.
     * @param {number} [limit=100]
     * @param {boolean} [includeDetails=false]
     * @returns {Promise<Array<Object>>}
     */
    async getMovies(limit = 100, includeDetails = false) {
      await this.loadConfig();

      if (this.dbUrl) {
        const selectFields = includeDetails
          ? '*'
          : 'id, title, platform, url, timestamp, date_formatted, word_count, noun_count, verb_count, adj_count, adv_count, created_at, updated_at';
        const sql = `
          SELECT ${selectFields} FROM fx_scanned_movies
          ORDER BY timestamp DESC
          LIMIT $1;
        `;
        const rows = await this.query(sql, [limit]);
        return rows.map((r) => this.mapRow(r));
      }

      // API mode via Cloud backend
      const res = await fetch(`${this.apiBase}/movies`);
      if (!res.ok) {
        throw new Error(`Neon API Error (${res.status})`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch movies from Neon');
      }
      const movies = (data.movies || []).slice(0, limit);
      return movies.map((r) => this.mapRow(r));
    }

    /**
     * Get a specific scanned movie by ID.
     * @param {string} id
     */
    async getMovieById(id) {
      if (!id) return null;
      await this.loadConfig();

      if (this.dbUrl) {
        const sql = `SELECT * FROM fx_scanned_movies WHERE id = $1 LIMIT 1;`;
        const rows = await this.query(sql, [id]);
        return rows.length > 0 ? this.mapRow(rows[0]) : null;
      }

      // API mode via Cloud backend
      const res = await fetch(`${this.apiBase}/movies/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error(`Neon API Error (${res.status})`);
      }
      const data = await res.json();
      return data.movie ? this.mapRow(data.movie) : null;
    }

    /**
     * Delete a movie by ID.
     * @param {string} id
     */
    async deleteMovie(id) {
      if (!id) return false;
      await this.loadConfig();

      if (this.dbUrl) {
        const sql = `DELETE FROM fx_scanned_movies WHERE id = $1 RETURNING id;`;
        const rows = await this.query(sql, [id]);
        return rows.length > 0;
      }

      // API mode via Cloud backend
      const res = await fetch(`${this.apiBase}/movies/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) return false;
      const data = await res.json().catch(() => ({}));
      return !!data.success;
    }

    /**
     * Clear all scanned movies from Neon database.
     */
    async clearAllMovies() {
      await this.loadConfig();

      if (this.dbUrl) {
        const sql = `DELETE FROM fx_scanned_movies;`;
        await this.query(sql);
        return true;
      }

      // API mode via Cloud backend
      const res = await fetch(`${this.apiBase}/movies`, {
        method: 'DELETE'
      });
      return res.ok;
    }

    /**
     * Save or update an item in Neon master known list.
     * @param {Object} item
     */
    async saveMasterItem(item) {
      if (!item || !item.text) return null;
      await this.loadConfig();

      const id = String(item.id || `m_${Date.now()}`);
      const text = String(item.text).trim().toLowerCase();
      const type = String(item.type || 'word');
      const pos = String(item.pos || 'N');
      const knownMeanings = Array.isArray(item.knownMeanings)
        ? item.knownMeanings
        : (Array.isArray(item.known_meanings) ? item.known_meanings : (item.meanings || []));

      if (this.dbUrl) {
        await this.initSchema();
        const rows = await this.query(`
          INSERT INTO fx_master_known_list (id, text, type, pos, known_meanings, updated_at)
          VALUES ($1, $2, $3, $4, $5::jsonb, NOW())
          ON CONFLICT (text) DO UPDATE SET
            pos = EXCLUDED.pos,
            known_meanings = EXCLUDED.known_meanings,
            updated_at = NOW()
          RETURNING *;
        `, [id, text, type, pos, JSON.stringify(knownMeanings)]);

        return rows[0] || null;
      }

      // API mode via Cloud backend
      const res = await fetch(`${this.apiBase}/master-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          text,
          type,
          pos,
          meanings: knownMeanings,
          knownMeanings
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`Failed to save master item (${res.status}): ${errText}`);
      }
      const data = await res.json();
      return data.item || null;
    }

    /**
     * Retrieve all items from Neon master known list.
     * @returns {Promise<Array<Object>>}
     */
    async getMasterItems() {
      await this.loadConfig();

      if (this.dbUrl) {
        await this.initSchema();
        const rows = await this.query(`
          SELECT id, text, type, pos, known_meanings, created_at
          FROM fx_master_known_list
          ORDER BY created_at DESC;
        `);
        return rows.map((r) => ({
          id: r.id,
          text: r.text,
          type: r.type,
          pos: r.pos,
          knownMeanings: typeof r.known_meanings === 'string' ? JSON.parse(r.known_meanings) : (r.known_meanings || []),
          createdAt: r.created_at
        }));
      }

      // API mode via Cloud backend
      const res = await fetch(`${this.apiBase}/master-list`);
      if (!res.ok) throw new Error(`Failed to fetch master list (${res.status})`);
      const data = await res.json();
      return (data.items || []).map((r) => ({
        id: r.id,
        text: r.text,
        type: r.type,
        pos: r.pos,
        knownMeanings: Array.isArray(r.knownMeanings)
          ? r.knownMeanings
          : (typeof r.known_meanings === 'string' ? JSON.parse(r.known_meanings) : (r.known_meanings || [])),
        createdAt: r.createdAt || r.created_at
      }));
    }

    /**
     * Delete an item from Neon master known list by id or text.
     * @param {string} idOrText
     */
    async deleteMasterItem(idOrText) {
      if (!idOrText) return false;
      await this.loadConfig();

      if (this.dbUrl) {
        await this.initSchema();
        await this.query(`
          DELETE FROM fx_master_known_list WHERE id = $1 OR text = $1;
        `, [String(idOrText).toLowerCase()]);
        return true;
      }

      // API mode via Cloud backend
      const res = await fetch(`${this.apiBase}/master-list?id=${encodeURIComponent(idOrText)}`, {
        method: 'DELETE'
      });
      return res.ok;
    }

    /**
     * Check connection health to Neon database.
     */
    async checkHealth() {
      await this.loadConfig();

      if (this.dbUrl) {
        try {
          const rows = await this.query(`SELECT 1 as alive;`);
          const isAlive = rows.length > 0 && rows[0].alive == 1;
          return {
            ok: isAlive,
            projectId: this.projectId,
            host: this.host,
            mode: 'direct'
          };
        } catch (err) {
          return {
            ok: false,
            error: err.message,
            projectId: this.projectId,
            host: this.host,
            mode: 'direct'
          };
        }
      }

      // Zero-key API route via Webapp backend
      try {
        const res = await fetch(`${this.apiBase}/movies`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        const data = await res.json().catch(() => ({}));
        const ok = res.ok && data.success === true;
        return {
          ok,
          host: 'fx-english-webapp.vercel.app',
          mode: 'api',
          error: ok ? undefined : (data.error || `HTTP ${res.status}`)
        };
      } catch (err) {
        return {
          ok: false,
          host: 'fx-english-webapp.vercel.app',
          mode: 'api',
          error: err.message
        };
      }
    }
  }

  return new NeonStorageClient();
});
