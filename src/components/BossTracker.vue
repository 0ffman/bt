<script setup>
import { useBossTracker } from '../composables/useBossTracker'
import { RESPAWN_WINDOW, getEstimateMinExtraHours } from '../bosses'

const {
  user, username, isDark, toggleTheme,
  monitorsFor, isMonitoring, toggleMonitor, lastKill, statusOf,
  countdownMs, fixedLeft, randomLeft, fmtHours, fmtMs,
  lowBosses, highBosses, testBosses, aliveCount,
  loadingId, manualEdit,
  addKill, openManual, cancelManual, saveManual, clearKill,
  formatTime, signOut,
} = useBossTracker()
</script>

<template>
  <div class="tracker" :class="{ 'dark-theme': isDark }">
    <header class="topbar">
      <span class="nick">Привет, <b>{{ username }}</b></span>
      <div class="topbar-center">
        <div class="theme-toggle-container" @click="toggleTheme">
          <span class="theme-icon moon">🌙</span>
          <div class="toggle-slider" :class="{ active: isDark }">
            <div class="toggle-knob" :class="{ active: isDark }"></div>
          </div>
          <span class="theme-icon sun">☀️</span>
        </div>
      </div>
      <button class="btn-ghost" @click="signOut">Выйти</button>
    </header>

    <div class="categories">
      <section
        v-for="col in [
          { title: 'Low A', bosses: lowBosses },
          { title: 'High A', bosses: highBosses },
        ]"
        :key="col.title"
        class="category"
      >
        <h3 class="col-title">
          {{ col.title }}
          <span class="counter">{{ aliveCount(col.bosses) }}/{{ col.bosses.length }} живых</span>
        </h3>

        <div class="cards-grid">
          <div
            v-for="boss in col.bosses"
            :key="boss.id"
            class="card"
            :class="[`status-${statusOf(boss)}`, { 'is-monitored': isMonitoring(boss.id) }]"
            @click="toggleMonitor(boss)"
            :title="isMonitoring(boss.id) ? 'Перестать мониторить' : 'Мониторить'"
          >
            <span class="dot" :class="`dot-${statusOf(boss)}`" />

            <div class="card-main">
              <div class="name-row">
                <span class="name">{{ boss.name }}</span>
                <span class="lvl">Lv.{{ boss.level }}</span>
              </div>

              <div v-if="manualEdit && manualEdit.bossId === boss.id" class="manual-form" @click.stop>
                <input type="datetime-local" v-model="manualEdit.value" class="manual-input" />
                <button class="kill-btn" @click.stop="saveManual" :disabled="loadingId === boss.id">Сохранить</button>
                <button class="btn-ghost small" @click.stop="cancelManual">Отмена</button>
              </div>

              <div v-else-if="lastKill(boss.id)" class="meta">
                <template v-if="statusOf(boss) === 'respawning'">
                  <span class="meta-item respawn">
                    Убит: {{ formatTime(lastKill(boss.id).killed_at) }}
                  </span>
                  <span class="meta-item respawn">
                    Фикс: {{ fmtHours(RESPAWN_WINDOW[boss.tier].fixed) }}
                    <span class="dim">(осталось {{ fmtMs(fixedLeft(boss)) }})</span>
                  </span>
                </template>

                <template v-else-if="statusOf(boss) === 'respawn_window'">
                  <span class="meta-item respawn-window">
                    Убит: {{ formatTime(lastKill(boss.id).killed_at) }}
                  </span>
                  <span class="meta-item respawn-window">
                    Окно: {{ fmtHours(RESPAWN_WINDOW[boss.tier].randomMax) }}
                    <span class="dim">(осталось {{ fmtMs(randomLeft(boss)) }})</span>
                  </span>
                </template>

                <template v-else-if="statusOf(boss) === 'estimate_min'">
                  <span class="meta-item estimate-min">
                    По мин.: {{ formatTime(lastKill(boss.id).killed_at) }}
                  </span>
                  <span class="meta-item estimate-min">
                    Респавн: {{ fmtHours(RESPAWN_WINDOW[boss.tier].fixed + getEstimateMinExtraHours(boss.tier)) }}
                    <span class="dim">(осталось {{ fmtMs(fixedLeft(boss)) }})</span>
                  </span>
                </template>

                <span v-else class="meta-item alive">
                  Реснулся: {{ formatTime(lastKill(boss.id).respawn_at) }}
                </span>
              </div>
            </div>

            <div v-if="!manualEdit || manualEdit.bossId !== boss.id" class="actions" @click.stop>
              <div v-if="monitorsFor(boss.id).length" class="monitors-wrapper">
                <span class="monitors-icon">👁</span>
                <span class="monitors-list">{{ monitorsFor(boss.id).map(m => m.username).join(', ') }}</span>
              </div>
              <button
                class="kill-btn"
                @click="addKill(boss, false)"
                :disabled="loadingId === boss.id || statusOf(boss) === 'respawning'"
              >
                {{ loadingId === boss.id ? '…' : 'Убил' }}
              </button>
              <button
                class="kill-btn min-btn"
                @click="addKill(boss, true)"
                :disabled="loadingId === boss.id || statusOf(boss) === 'respawning' || statusOf(boss) === 'estimate_min'"
              >
                По мин.
              </button>
              <button class="kill-btn ghost-btn" @click="openManual(boss)" :disabled="loadingId === boss.id" title="Ввести время">
                ⏱
              </button>
              <button
                v-if="lastKill(boss.id)"
                class="kill-btn clear-btn"
                @click="clearKill(boss)"
                :disabled="loadingId === boss.id"
                title="Очистить"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section v-if="testBosses.length" class="test-section">
      <h3 class="test-title">TEST</h3>
      <div class="cards-grid">
        <div
          v-for="boss in testBosses"
          :key="boss.id"
          class="card"
          :class="[`status-${statusOf(boss)}`, { 'is-monitored': isMonitoring(boss.id) }]"
          @click="toggleMonitor(boss)"
          :title="isMonitoring(boss.id) ? 'Перестать мониторить' : 'Мониторить'"
        >
          <span class="dot" :class="`dot-${statusOf(boss)}`" />

          <div class="card-main">
            <div class="name-row">
              <span class="name">{{ boss.name }}</span>
              <span class="lvl">Lv.{{ boss.level }}</span>
            </div>

            <div v-if="manualEdit && manualEdit.bossId === boss.id" class="manual-form" @click.stop>
              <input type="datetime-local" v-model="manualEdit.value" class="manual-input" />
              <button class="kill-btn" @click.stop="saveManual" :disabled="loadingId === boss.id">Сохранить</button>
              <button class="btn-ghost small" @click.stop="cancelManual">Отмена</button>
            </div>

            <div v-else-if="lastKill(boss.id)" class="meta">
              <template v-if="statusOf(boss) === 'respawning'">
                <span class="meta-item respawn">
                  Убит: {{ formatTime(lastKill(boss.id).killed_at) }}
                </span>
                <span class="meta-item respawn">
                  Фикс: {{ fmtHours(RESPAWN_WINDOW[boss.tier]?.fixed ?? 10) }}
                  <span class="dim">(осталось {{ fmtMs(fixedLeft(boss)) }})</span>
                </span>
              </template>

              <template v-else-if="statusOf(boss) === 'respawn_window'">
                <span class="meta-item respawn-window">
                  Убит: {{ formatTime(lastKill(boss.id).killed_at) }}
                </span>
                <span class="meta-item respawn-window">
                  Окно: {{ fmtHours(RESPAWN_WINDOW[boss.tier]?.randomMax ?? 4) }}
                  <span class="dim">(осталось {{ fmtMs(randomLeft(boss)) }})</span>
                </span>
              </template>

              <template v-else-if="statusOf(boss) === 'estimate_min'">
                <span class="meta-item estimate-min">
                  По мин.: {{ formatTime(lastKill(boss.id).killed_at) }}
                </span>
                <span class="meta-item estimate-min">
                  Респавн: {{ fmtHours((RESPAWN_WINDOW[boss.tier]?.fixed ?? 10) + getEstimateMinExtraHours(boss.tier)) }}
                  <span class="dim">(осталось {{ fmtMs(fixedLeft(boss)) }})</span>
                </span>
              </template>

              <span v-else class="meta-item alive">
                Реснулся: {{ formatTime(lastKill(boss.id).respawn_at) }}
              </span>
            </div>
          </div>

          <div v-if="!manualEdit || manualEdit.bossId !== boss.id" class="actions" @click.stop>
            <div v-if="monitorsFor(boss.id).length" class="monitors-wrapper">
              <span class="monitors-icon">👁</span>
              <span class="monitors-list">{{ monitorsFor(boss.id).map(m => m.username).join(', ') }}</span>
            </div>
            <button
              class="kill-btn"
              @click="addKill(boss, false)"
              :disabled="loadingId === boss.id || statusOf(boss) === 'respawning'"
            >
              {{ loadingId === boss.id ? '…' : 'Убил' }}
            </button>
            <button
              class="kill-btn min-btn"
              @click="addKill(boss, true)"
              :disabled="loadingId === boss.id || statusOf(boss) === 'respawning' || statusOf(boss) === 'estimate_min'"
            >
              По мин.
            </button>
            <button class="kill-btn ghost-btn" @click="openManual(boss)" :disabled="loadingId === boss.id" title="Ввести время">
              ⏱
            </button>
            <button
              v-if="lastKill(boss.id)"
              class="kill-btn clear-btn"
              @click="clearKill(boss)"
              :disabled="loadingId === boss.id"
              title="Очистить"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* ====== Базовые стили (светлая тема) ====== */
.tracker {
  width: 100%;
  padding: 1.25rem 1.5rem;
  color: #1e2024;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  background: #e9ebef;
  min-height: 100vh;
  box-sizing: border-box;
  transition: background 0.3s, color 0.3s;
}

.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.25rem;
  padding: 0.6rem 0.9rem;
  background: #ffffff;
  border: 1px solid #cbd0d9;
  border-radius: 10px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  transition: background 0.3s, border-color 0.3s;
}
.nick { font-size: 0.85rem; color: #4a5058; }

.topbar-center {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.theme-toggle-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.theme-icon {
  font-size: 1.1rem;
  line-height: 1;
  opacity: 0.6;
  transition: opacity 0.2s;
}
.theme-icon.moon { opacity: 0.6; }
.theme-icon.sun { opacity: 0.6; }

.dark-theme .theme-icon.moon { opacity: 1; }
.dark-theme .theme-icon.sun { opacity: 0.4; }

.toggle-slider {
  width: 36px;
  height: 18px;
  background: #d0d0d0;
  border-radius: 18px;
  position: relative;
  transition: background 0.3s;
}

.toggle-slider.active {
  background: #555;
}

.toggle-knob {
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  position: absolute;
  top: 2px;
  left: 2px;
  transition: left 0.3s, background 0.3s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

.toggle-knob.active {
  left: 20px;
  background: #f0c674;
}

.btn-ghost {
  background: #ffffff;
  border: 1px solid #cbd0d9;
  color: #1e2024;
  padding: 0.35rem 0.8rem;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.btn-ghost:hover { background: #eef1f5; border-color: #5b8def; }
.btn-ghost.small { padding: 0.25rem 0.5rem; font-size: 0.75rem; }

.categories {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 1300px) { .categories { grid-template-columns: 1fr; } }

.category {
  background: #ffffff;
  border: 1px solid #cbd0d9;
  border-radius: 12px;
  padding: 0.9rem;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
  transition: background 0.3s, border-color 0.3s;
}

.col-title {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: #16181c;
}
.counter { font-size: 0.75rem; color: #6b7280; font-weight: 400; }

.cards-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}
@media (max-width: 720px) { .cards-grid { grid-template-columns: 1fr; } }

.card {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border: 2px solid;
  border-radius: 8px;
  min-width: 0;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.15s;
  background: #ffffff;
}
.card:hover { transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
.card.is-monitored {
  outline: 2px solid #3a7bd5;
  outline-offset: 1px;
}

.card.status-respawning     { background: #ffe6e6; border-color: #d96c6c; }
.card.status-respawn_window { background: #ffe4c4; border-color: #d98c40; }
.card.status-estimate_min   { background: #fff2b0; border-color: #d4b820; }
.card.status-alive          { background: #daf0e0; border-color: #68b88a; }

.dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.08); }
.dot-respawning     { background: #d93030; }
.dot-respawn_window { background: #d98020; }
.dot-estimate_min   { background: #c4a000; }
.dot-alive          { background: #28a05a; }

.card-main { flex: 1; min-width: 0; }

.name-row { display: flex; align-items: baseline; gap: 0.35rem; min-width: 0; flex-wrap: wrap; }
.name {
  font-weight: 600;
  font-size: 0.85rem;
  word-break: break-word;
  color: #1e2024;
}
.lvl { font-size: 0.7rem; color: #6b7280; flex-shrink: 0; }

.monitors-wrapper {
  font-size: 0.75rem;
  color: #3a6edb;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: rgba(58, 110, 219, 0.12);
  padding: 2px 8px 2px 6px;
  border-radius: 12px;
  cursor: default;
  transition: background 0.15s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
  flex-shrink: 0;
}
.monitors-wrapper:hover {
  background: rgba(58, 110, 219, 0.2);
}

.monitors-icon {
  font-size: 1rem;
  line-height: 1;
  flex-shrink: 0;
}

.monitors-list {
  font-size: 0.8rem;
  color: #2b5ed9;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta {
  margin-top: 2px;
  font-size: 0.72rem;
  line-height: 1.3;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.meta-item { color: #4a5058; white-space: nowrap; }
.meta-item.respawn { color: #b03030; font-weight: 600; }
.meta-item.respawn-window { color: #a05c00; font-weight: 600; }
.meta-item.estimate-min { color: #8a7a00; font-weight: 600; }
.meta-item.alive { color: #1a7a3a; font-weight: 600; }
.dim { color: #8a9099; }

.manual-form {
  display: flex;
  gap: 0.3rem;
  align-items: center;
  margin-top: 4px;
  flex-wrap: wrap;
}
.manual-input {
  padding: 0.25rem 0.4rem;
  border: 1px solid #c4c9d2;
  border-radius: 6px;
  font-size: 0.72rem;
  background: #fff;
  color: #1e2024;
}

.actions {
  display: flex;
  gap: 0.3rem;
  flex-shrink: 0;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-items: center;
}

.kill-btn {
  border: none;
  padding: 0.35rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s, transform 0.06s, box-shadow 0.12s;
  box-shadow: 0 1px 3px rgba(0,0,0,0.15);
}

.kill-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
}

.kill-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0,0,0,0.15);
}

.kill-btn:disabled {
  opacity: 0.5;
  cursor: default;
  box-shadow: none;
}

.kill-btn:not(.min-btn):not(.ghost-btn):not(.clear-btn) {
  background: #2a7de0;
  color: #ffffff;
}
.kill-btn:not(.min-btn):not(.ghost-btn):not(.clear-btn):hover:not(:disabled) {
  background: #1a6bc8;
}

.min-btn {
  background: #d98c20;
  color: #ffffff;
}
.min-btn:hover:not(:disabled) {
  background: #c07c18;
}
.min-btn:disabled {
  background: #c0a060;
  color: #fff;
  opacity: 0.6;
}

.ghost-btn {
  background: #f0f2f5;
  color: #1e2024;
  border: 1px solid #cbd0d9;
  box-shadow: none;
}
.ghost-btn:hover:not(:disabled) {
  background: #e2e6ec;
  border-color: #5b8def;
}

.clear-btn {
  background: #e6d0d0;
  color: #b03030;
  border: 1px solid #c09292;
  box-shadow: none;
}
.clear-btn:hover:not(:disabled) {
  background: #dbb8b8;
}

@media (max-width: 400px) {
  .card {
    flex-direction: column;
    align-items: stretch;
    gap: 0.3rem;
    padding: 0.5rem;
  }
  .name-row { flex-wrap: wrap; }
  .name { font-size: 0.85rem; white-space: normal; overflow: visible; text-overflow: clip; }
  .lvl { font-size: 0.75rem; }
  .monitors-wrapper { max-width: 100%; justify-content: flex-start; }
  .actions { justify-content: flex-start; margin-top: 0.2rem; }
  .meta { flex-direction: column; gap: 0.2rem; }
  .manual-form { flex-direction: column; align-items: stretch; }
}

/* ====== Тёмная тема (переопределяем только фон страницы и колонок) ====== */
.tracker.dark-theme {
  background: #1a1c20;
  color: #e0e0e0;
}

.tracker.dark-theme .topbar {
  background: #2a2d34;
  border-color: #3b3e47;
  color: #d0d0d0;
}
.tracker.dark-theme .topbar .nick {
  color: #b0b0b0;
}
.tracker.dark-theme .btn-ghost {
  background: #2a2d34;
  border-color: #4a4d55;
  color: #d0d0d0;
}
.tracker.dark-theme .btn-ghost:hover {
  background: #3b3e47;
}

.tracker.dark-theme .category {
  background: #2a2d34;
  border-color: #3b3e47;
  box-shadow: 0 1px 4px rgba(0,0,0,0.3);
}

.tracker.dark-theme .col-title {
  color: #d0d0d0;
}
.tracker.dark-theme .col-title .counter {
  color: #8a9099;
}

/* Карточки не трогаем – оставляем их цвета как есть */
.tracker.dark-theme .card {
  background: #2a2d34; /* только для карточек без статуса? но они переопределены статусами, так что фон будет из классов */
}

.tracker.dark-theme .name {
  color: #e0e0e0;
}
.tracker.dark-theme .lvl {
  color: #8a9099;
}

.tracker.dark-theme .monitors-wrapper {
  background: rgba(58, 110, 219, 0.2);
  color: #6a9eff;
}
.tracker.dark-theme .monitors-list {
  color: #6a9eff;
}

.tracker.dark-theme .meta .meta-item {
  color: #b0b0b0;
}
.tracker.dark-theme .meta .dim {
  color: #6b7280;
}

.tracker.dark-theme .kill-btn {
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}
.tracker.dark-theme .ghost-btn {
  background: #3b3e47;
  border-color: #4a4d55;
  color: #d0d0d0;
}
.tracker.dark-theme .ghost-btn:hover {
  background: #4a4d55;
}
.tracker.dark-theme .clear-btn {
  background: #3b2a2a;
  border-color: #5a4040;
  color: #e08080;
}
.tracker.dark-theme .clear-btn:hover {
  background: #4a3030;
}

.tracker.dark-theme .manual-input {
  background: #3b3e47;
  border-color: #4a4d55;
  color: #e0e0e0;
}

/* Тестовая секция в тёмной теме */
.tracker.dark-theme .test-section {
  background: #2a2d34;
}
.tracker.dark-theme .test-title {
  color: #8a9099;
}

/* Медиа-запрос для тёмной темы (опционально) */
@media (max-width: 400px) {
  .tracker.dark-theme .name {
    color: #e0e0e0;
  }
}

/* Тестовая секция (светлая) */
.test-section {
  margin-top: 2rem;
  padding: 0.9rem;
  background: #f4f5f7;
  border-radius: 12px;
  transition: background 0.3s;
}
.test-title {
  margin: 0 0 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #6b7280;
  font-style: italic;
}
</style>