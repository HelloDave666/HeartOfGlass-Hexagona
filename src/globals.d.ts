/**
 * globals.d.ts - Déclarations globales TypeScript
 * Permet à TypeScript de reconnaître les classes chargées dynamiquement
 * dans le contexte Electron (Node.js + Browser)
 */

// ===== Classe Exercise =====
declare class Exercise {
    id: string;
    name: string;
    description: string;
    craft: string;
    levels: any[];
    currentLevel: number;
    isActive: boolean;
    startTime: number | null;
    score: number;

    constructor(id: string, config?: any);
    
    start(levelIndex?: number): void;
    stop(): void;
    reset(): void;
    update(sensorData: any): any;
    isCompleted(): boolean;
    getCurrentLevel(): any;
    getStats(): any;
    
    onStart(): void;
    onStop(): void;
    onReset(): void;
}

// ===== Classe ExerciseLevel =====
declare class ExerciseLevel {
    number: number;
    name: string;
    description: string;
    requirements: Record<string, any>;
    successCriteria: {
        minScore: number;
        minAccuracy: number;
    };
    starThresholds: {
        bronze: number;
        silver: number;
        gold: number;
    };
    rewards: {
        xp: number;
        gems: number;
    };

    constructor(config?: any);
    
    calculateStars(score: number): number;
    isSuccess(stats: any): boolean;
}

// ===== Classe HeartOfFrostExercise =====
declare class HeartOfFrostExercise extends Exercise {
    targetRPM: number;
    targetDegreesPerSec: number;
    tolerance: number;
    smoothingFactor: number;
    currentAngularVelocity: number;
    smoothedVelocity: number;
    rotationCount: number;
    regularityScore: number;
    totalSamples: number;
    accurateSamples: number;

    constructor();
    
    static createLevels(): any[];
    
    resetMetrics(): void;
    updateRotationCount(angularVelocity: number): void;
    calculatePlaybackRate(velocityRatio: number): number;
    isVelocityAccurate(velocityRatio: number, tolerance: number): boolean;
    updateRegularityScore(velocityRatio: number, tolerance: number): void;
    calculateVolume(): number;
    getFeedback(velocityRatio: number, tolerance: number): any;
    getAccuracy(): number;
    calculateFinalScore(): number;
    getInactiveState(): any;
}

// ===== Augmentation de Window =====
interface Window {
    Exercise: typeof Exercise;
    ExerciseLevel: typeof ExerciseLevel;
    HeartOfFrostExercise: typeof HeartOfFrostExercise;
}

// ===== Déclarations globales (Node.js) =====
declare global {
    var Exercise: typeof Exercise;
    var ExerciseLevel: typeof ExerciseLevel;
    var HeartOfFrostExercise: typeof HeartOfFrostExercise;
}

// Export vide nécessaire pour que TypeScript traite ce fichier comme un module
export {};