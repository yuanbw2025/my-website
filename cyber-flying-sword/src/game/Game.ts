import * as THREE from 'three';

// 基础设施
import { TimeManager } from './TimeManager';
import { GameLoop } from './GameLoop';

// 输入
import { MediaPipeInput } from './input/MediaPipeInput';
import { InputFilter } from './input/InputFilter';
import { GestureDetector, GestureType } from './input/GestureDetector';

// 物理
import { WhipPhysics } from './physics/WhipPhysics';
// PlayerPhysics is used internally via Player entity
import { CollisionSystem } from './physics/CollisionSystem';

// 战斗
import { DamageSystem } from './combat/DamageSystem';
import { ShieldSystem } from './combat/ShieldSystem';
import { RageSystem } from './combat/RageSystem';
import { HitStop } from './combat/HitStop';

// 实体
import { Player } from './entities/Player';
import { Enemy } from './entities/Enemy';
import { spawnWave } from './entities/EnemyTypes';

// 渲染
import { SceneSetup } from './rendering/SceneSetup';
import { WhipRenderer } from './rendering/WhipRenderer';
import { TrailRenderer } from './rendering/TrailRenderer';
import { EffectsManager } from './rendering/EffectsManager';
import { EnvironmentRenderer } from './rendering/EnvironmentRenderer';

// 音频
import { AudioManager } from './audio/AudioManager';
import { SoundEffects } from './audio/SoundEffects';

/**
 * 游戏场景状态
 */
export type GameScene = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';

/**
 * 游戏状态快照（传递给 React UI）
 */
export interface GameStateSnapshot {
  scene: GameScene;
  hp: number;
  maxHp: number;
  shield: number;
  maxShield: number;
  rage: number;
  maxRage: number;
  gesture: GestureType;
  wave: number;
  enemiesLeft: number;
}

type StateChangeCallback = (state: GameStateSnapshot) => void;

/**
 * Game — 游戏主类
 * 
 * 初始化所有子系统，编排主循环：
 * Input → Physics → Combat → Rendering → Audio
 * 
 * 通过回调与 React UI 通信。
 */
export class Game {
  // ===== 子系统 =====
  private _timeManager: TimeManager;
  private _gameLoop: GameLoop;
  private _mediaPipe: MediaPipeInput;
  private _inputFilter: InputFilter;
  private _gestureDetector: GestureDetector;
  private _whipPhysics: WhipPhysics;
  private _collisionSystem: CollisionSystem;
  private _damageSystem: DamageSystem;
  private _shieldSystem: ShieldSystem;
  private _rageSystem: RageSystem;
  private _hitStop: HitStop;
  private _player: Player;
  private _sceneSetup: SceneSetup;
  private _whipRenderer: WhipRenderer;
  private _trailRenderer: TrailRenderer;
  private _effectsManager: EffectsManager;
  private _environmentRenderer: EnvironmentRenderer;
  private _audioManager: AudioManager;
  private _soundEffects: SoundEffects;

  // ===== 游戏状态 =====
  private _scene: GameScene = 'MENU';
  private _enemies: Enemy[] = [];
  private _wave: number = 0;
  private _elapsed: number = 0;

  // ===== 临时变量 =====
  private _filteredPos = new THREE.Vector3();

  // ===== 回调 =====
  private _onStateChange: StateChangeCallback | null = null;

  /** MediaPipe 输入（暴露给 UI 获取 videoElement） */
  get mediaPipe(): MediaPipeInput {
    return this._mediaPipe;
  }

  constructor(container: HTMLElement) {
    // 基础设施
    this._timeManager = new TimeManager();
    this._gameLoop = new GameLoop(this._timeManager);

    // 输入
    this._mediaPipe = new MediaPipeInput();
    this._inputFilter = new InputFilter();
    this._gestureDetector = new GestureDetector();

    // 物理
    this._whipPhysics = new WhipPhysics();
    this._collisionSystem = new CollisionSystem();

    // 战斗
    this._damageSystem = new DamageSystem();
    this._shieldSystem = new ShieldSystem();
    this._rageSystem = new RageSystem();
    this._hitStop = new HitStop(this._timeManager);

    // 实体
    this._player = new Player();

    // 渲染
    this._sceneSetup = new SceneSetup(container);
    this._whipRenderer = new WhipRenderer();
    this._trailRenderer = new TrailRenderer();
    this._effectsManager = new EffectsManager(this._sceneSetup.scene);
    this._environmentRenderer = new EnvironmentRenderer(this._sceneSetup.scene);

    // 添加渲染对象到场景
    this._sceneSetup.scene.add(this._whipRenderer.mesh);
    this._sceneSetup.scene.add(this._trailRenderer.points);

    // 音频
    this._audioManager = new AudioManager();
    this._soundEffects = new SoundEffects(this._audioManager);

    // 注册主循环
    this._gameLoop.onTick(this._tick);
  }

  /**
   * 注册状态变化回调（React UI 用）
   */
  onStateChange(callback: StateChangeCallback): void {
    this._onStateChange = callback;
  }

  /**
   * 开始游戏
   * 初始化 MediaPipe + Audio，然后启动循环
   */
  async start(): Promise<void> {
    // 初始化音频（需要用户交互）
    await this._audioManager.init();

    // 初始化 MediaPipe
    await this._mediaPipe.init();

    // 初始化游戏状态
    this._player.reset(new THREE.Vector3(0, 0, 0));
    this._whipPhysics.resetTo(this._player.position);
    this._wave = 0;
    this._spawnNextWave();

    // 切换到游戏状态
    this._scene = 'PLAYING';
    this._notifyStateChange();

    // 启动主循环
    this._gameLoop.start();
  }

  /** 暂停 */
  pause(): void {
    if (this._scene === 'PLAYING') {
      this._scene = 'PAUSED';
      this._gameLoop.stop();
      this._notifyStateChange();
    }
  }

  /** 恢复 */
  resume(): void {
    if (this._scene === 'PAUSED') {
      this._scene = 'PLAYING';
      this._gameLoop.start();
      this._notifyStateChange();
    }
  }

  /** 销毁所有资源 */
  dispose(): void {
    this._gameLoop.stop();
    this._mediaPipe.dispose();
    this._audioManager.dispose();
    this._sceneSetup.dispose();
    this._whipRenderer.dispose();
    this._trailRenderer.dispose();
    this._effectsManager.dispose();
    this._environmentRenderer.dispose();
  }

  // ===================== 主循环 =====================

  private _tick = (_rawDt: number, scaledDt: number, elapsed: number): void => {
    if (this._scene !== 'PLAYING') return;

    this._elapsed = elapsed;

    // === 1. 输入处理 ===
    this._processInput();

    // === 2. 物理更新 ===
    this._updatePhysics(scaledDt);

    // === 3. 战斗逻辑 ===
    this._updateCombat();

    // === 4. 实体更新 ===
    this._updateEntities(scaledDt);

    // === 5. 渲染 ===
    this._updateRendering(scaledDt);

    // === 6. 状态通知 ===
    this._notifyStateChange();
  };

  // ===================== 输入处理 =====================

  private _processInput(): void {
    if (!this._mediaPipe.hasHand) {
      this._gestureDetector.clearHand();
      this._player.gesture = 'NONE';
      return;
    }

    const landmarks = this._mediaPipe.landmarks!;

    // 手势检测
    const prevGesture = this._gestureDetector.gesture;
    const gesture = this._gestureDetector.detect(landmarks);
    this._player.gesture = gesture;

    // 手势切换通知护盾系统
    if (gesture !== prevGesture) {
      this._shieldSystem.onGestureChange(gesture);
    }

    // 获取手指位置并滤波
    const rawPos = this._mediaPipe.getFingerTipWorld();
    if (rawPos) {
      this._filteredPos.copy(this._inputFilter.update(rawPos));
    }
  }

  // ===================== 物理更新 =====================

  private _updatePhysics(dt: number): void {
    const gesture = this._player.gesture;

    if (gesture === 'FIST') {
      // 握拳 → 鞭子收回旋转成护盾
      this._whipPhysics.contractToShield(this._player.position, this._elapsed);
    } else if (gesture === 'WHIP' || gesture === 'NONE') {
      // 正常挥鞭
      this._whipPhysics.update(this._filteredPos, dt);
    }

    // 角色物理
    this._player.physics.update(
      this._whipPhysics.nodes,
      dt,
      gesture === 'FIST'
    );

    // 护盾回复
    this._player.regenShield(dt);
  }

  // ===================== 战斗逻辑 =====================

  private _updateCombat(): void {
    const player = this._player;

    // --- 大招判定 ---
    if (player.gesture === 'ULTIMATE' && this._rageSystem.isFull) {
      if (this._rageSystem.tryConsumeForUltimate()) {
        this._executeUltimate();
      }
    }

    // --- 鞭子 vs 敌人 ---
    if (player.gesture === 'WHIP') {
      for (const enemy of this._enemies) {
        if (!enemy.alive) continue;

        const hit = this._collisionSystem.whipVsEnemy(
          this._whipPhysics.nodes,
          (i) => this._whipPhysics.getSegmentVelocity(i),
          enemy
        );

        if (hit) {
          const damage = this._damageSystem.calculateWhipDamage(
            hit.segmentIndex,
            hit.segmentVelocity
          );

          if (damage > 0) {
            enemy.takeDamage(damage);
            this._rageSystem.onWhipHit();
            this._hitStop.onWhipHit();
            this._effectsManager.spawnSparks(enemy.x, enemy.y);
            this._soundEffects.whipHit();
          }
        }
      }
    }

    // --- 敌人攻击 vs 玩家 ---
    for (const enemy of this._enemies) {
      if (!enemy.alive || !enemy.attack.active) continue;

      const attackPos = enemy.getAttackWorldPos();
      const hit = this._collisionSystem.playerVsAttack(
        player.x, player.y, player.collisionRadius,
        attackPos.x, attackPos.y, attackPos.radius
      );

      if (hit) {
        const result = this._shieldSystem.processIncomingDamage(
          enemy.attack.damage,
          player.shield,
          player.gesture
        );

        player.takeDamage(result.damageDealt);
        player.consumeShield(result.shieldCost);
        this._rageSystem.add(result.rageGain);

        if (result.isPerfectBlock) {
          this._hitStop.onPerfectBlock();
          this._effectsManager.triggerPerfectBlockFlash();
          this._soundEffects.perfectBlock();
        } else if (result.damageDealt > 0) {
          this._soundEffects.playerHit();
        } else {
          this._soundEffects.block();
        }

        // 标记攻击已判定，防止多次命中
        enemy.attack.active = false;
      }
    }

    // --- 气流罩碰撞 ---
    if (player.physics.hasAirflow) {
      for (const enemy of this._enemies) {
        if (!enemy.alive) continue;
        const collision = this._collisionSystem.playerVsEnemy(
          player.x, player.y, player.collisionRadius,
          enemy
        );
        if (collision.hit) {
          const speed = player.physics.velocity.length();
          const damage = this._damageSystem.calculateAirflowDamage(speed);
          if (damage > 0) {
            enemy.takeDamage(damage);
            this._soundEffects.enemyHit();
            this._effectsManager.spawnSparks(enemy.x, enemy.y);
          }
        }
      }
    }

    // --- 死亡检测 ---
    if (!player.alive) {
      this._scene = 'GAME_OVER';
      this._gameLoop.stop();
    }

    // --- 波次清空检测 ---
    const aliveEnemies = this._enemies.filter(e => e.alive);
    if (aliveEnemies.length === 0) {
      this._spawnNextWave();
    }
  }

  // ===================== 实体更新 =====================

  private _updateEntities(dt: number): void {
    for (const enemy of this._enemies) {
      enemy.updateAI(this._player.x, this._player.y, dt);
    }
  }

  // ===================== 渲染更新 =====================

  private _updateRendering(dt: number): void {
    // HitStop
    this._hitStop.update(dt);
    const shake = this._hitStop.getCameraOffset();
    this._sceneSetup.applyScreenShake(shake.x, shake.y);

    // 鞭子渲染
    if (this._player.gesture === 'FIST') {
      this._whipRenderer.updateShieldMode(
        this._player.x,
        this._player.y,
        this._elapsed
      );
    } else {
      this._whipRenderer.update(
        this._whipPhysics.nodes,
        (i) => this._whipPhysics.getSegmentVelocity(i)
      );
    }

    // 拖尾
    this._trailRenderer.update(this._whipPhysics.nodes);

    // 气流罩
    this._effectsManager.updateAirflow(
      this._player.physics.hasAirflow,
      this._player.x,
      this._player.y
    );

    // 命中火花等特效
    this._effectsManager.update(dt);

    // 环境
    this._environmentRenderer.update(dt);
    this._sceneSetup.updateLightning(dt);

    // 渲染
    this._sceneSetup.render();
  }

  // ===================== 辅助方法 =====================

  private _spawnNextWave(): void {
    this._wave++;
    this._enemies = spawnWave(this._wave);
  }

  private _executeUltimate(): void {
    this._hitStop.onUltimate();
    this._soundEffects.ultimate();

    // 对所有存活敌人造成大量伤害
    for (const enemy of this._enemies) {
      if (enemy.alive) {
        enemy.takeDamage(50); // 大招固定高伤害
        this._effectsManager.spawnSparks(enemy.x, enemy.y, 0, 24);
      }
    }
  }

  private _notifyStateChange(): void {
    if (!this._onStateChange) return;

    this._onStateChange({
      scene: this._scene,
      hp: this._player.hp,
      maxHp: this._player.maxHp,
      shield: this._player.shield,
      maxShield: this._player.maxShield,
      rage: this._rageSystem.rage,
      maxRage: 100,
      gesture: this._player.gesture,
      wave: this._wave,
      enemiesLeft: this._enemies.filter(e => e.alive).length,
    });
  }
}
