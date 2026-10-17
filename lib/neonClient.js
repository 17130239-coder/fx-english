/**
 * FX English - Neon Serverless Database Client
 * Direct HTTPS query to Neon Postgres serverless /sql endpoint.
 * Persists and synchronizes scanned movies/videos, vocabulary analysis, and subtitle cues.
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
    DB_URL: 'postgresql://neondb_owner:npg_bP5BYGwKusi2@ep-super-cake-az82uvk1-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require',
    PROJECT_ID: 'wild-band-00612836',
    HOST: 'ep-super-cake-az82uvk1-pooler.c-3.ap-southeast-1.aws.neon.tech'
  };

  class NeonStorageClient {
    constructor() {
      this.dbUrl = DEFAULT_CONFIG.DB_URL;
      this.projectId = DEFAULT_CONFIG.PROJECT_ID;
      this.host = DEFAULT_CONFIG.HOST;
      this.endpoint = `https://${this.host}/sql`;
      this.initUrl(this.dbUrl);
    }

    /**
     * Parse connection string and set up HTTPS /sql endpoint.
     * @param {string} url
     */
    initUrl(url) {
      this.dbUrl = (url && String(url).trim()) || DEFAULT_CONFIG.DB_URL;
      try {
        const normalized = this.dbUrl.replace(/^postgres(ql)?:\/\//i, 'http://');
        const parsed = new URL(normalized);
        this.host = parsed.host || DEFAULT_CONFIG.HOST;
        this.endpoint = `https://${this.host}/sql`;
      } catch (e) {
        this.host = DEFAULT_CONFIG.HOST;
        this.endpoint = `https://${this.host}/sql`;
      }
    }

    /**
     * Asynchronously loads custom Neon configuration if configured by user in storage.
     */
    async loadConfig() {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
          chrome.storage.local.get(['neonDatabaseUrl'], (res) => {
            if (res && res.neonDatabaseUrl) {
              this.initUrl(res.neonDatabaseUrl);
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

      await this.query(`CREATE INDEX IF NOT EXISTS idx_fx_scanned_movies_timestamp ON fx_scanned_movies (timestamp DESC);`).catch(() => {});
      await this.query(`CREATE INDEX IF NOT EXISTS idx_fx_scanned_movies_platform ON fx_scanned_movies (platform);`).catch(() => {});
      await this.query(`CREATE INDEX IF NOT EXISTS idx_fx_scanned_movies_title ON fx_scanned_movies (title);`).catch(() => {});
      return true;
    }

    /**
     * Map database row to standard scanned movie history item.
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
        dateFormatted: String(row.date_formatted || ''),
        wordCount: Number(row.word_count) || 0,
        nounCount: Number(row.noun_count) || 0,
        verbCount: Number(row.verb_count) || 0,
        adjCount: Number(row.adj_count) || 0,
        advCount: Number(row.adv_count) || 0,
        cues: Array.isArray(cues) ? cues : [],
        analysis: analysis,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    }

    /**
     * Insert or update a scanned movie and its full vocabulary analysis in Neon.
     * @param {Object} item
     */
    async saveMovie(item) {
      if (!item || !item.title) return null;

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

    /**
     * Fetch scanned movies from Neon.
     * @param {number} limit
     * @returns {Promise<Array<Object>>}
     */
    async getMovies(limit = 100) {
      const sql = `
        SELECT * FROM fx_scanned_movies
        ORDER BY timestamp DESC
        LIMIT $1;
      `;
      const rows = await this.query(sql, [limit]);
      return rows.map((r) => this.mapRow(r));
    }

    /**
     * Get a specific scanned movie by ID.
     * @param {string} id
     */
    async getMovieById(id) {
      if (!id) return null;
      const sql = `SELECT * FROM fx_scanned_movies WHERE id = $1 LIMIT 1;`;
      const rows = await this.query(sql, [id]);
      return rows.length > 0 ? this.mapRow(rows[0]) : null;
    }

    /**
     * Delete a movie by ID.
     * @param {string} id
     */
    async deleteMovie(id) {
      if (!id) return false;
      const sql = `DELETE FROM fx_scanned_movies WHERE id = $1 RETURNING id;`;
      const rows = await this.query(sql, [id]);
      return rows.length > 0;
    }

    /**
     * Clear all scanned movies from Neon database.
     */
    async clearAllMovies() {
      const sql = `DELETE FROM fx_scanned_movies;`;
      await this.query(sql);
      return true;
    }

    /**
     * Check connection health to Neon database.
     */
    async checkHealth() {
      try {
        const rows = await this.query(`SELECT 1 as alive;`);
        const isAlive = rows.length > 0 && rows[0].alive == 1;
        return {
          ok: isAlive,
          projectId: this.projectId,
          host: this.host
        };
      } catch (err) {
        return {
          ok: false,
          error: err.message,
          projectId: this.projectId,
          host: this.host
        };
      }
    }
  }

  return new NeonStorageClient();
});
