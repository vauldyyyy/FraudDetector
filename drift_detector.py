"""
FraudLens - Concept Drift Detector (ADWIN-inspired)
=====================================================
Monitors prediction confidence distribution and detects when the
model's behavior shifts — indicating concept drift.

Real-world fraud patterns EVOLVE:
  - New attack vectors emerge
  - User behavior shifts (seasonality, economic changes)
  - Adversarial adaptation (fraudsters learn to evade detection)

This module implements:
  1. ADWIN-inspired sliding window drift detection
  2. Population Stability Index (PSI) for feature drift
  3. Kolmogorov-Smirnov test for distribution shift
  4. Automated retraining trigger recommendations

This addresses the TCD critique: "no real-world challenges addressed"

Run: python drift_detector.py
"""

import os
import json
import time
import numpy as np
import pandas as pd
from collections import deque
from datetime import datetime
from scipy import stats

MODEL_DIR = "ml-models"


class ADWINDriftDetector:
    """
    ADWIN (ADaptive WINdowing) inspired concept drift detector.
    
    Maintains a sliding window of prediction confidences and detects
    statistically significant changes between sub-windows.
    
    This is a simplified but functional implementation of the ADWIN algorithm
    (Bifet & Gavalda, 2007) adapted for fraud detection drift monitoring.
    """
    
    def __init__(self, delta=0.002, min_window=50):
        """
        Args:
            delta: Confidence level for drift detection (lower = more sensitive)
            min_window: Minimum sub-window size for comparison
        """
        self.delta = delta
        self.min_window = min_window
        self.window = deque()
        self.drift_points = []
        self.total_seen = 0
    
    def add_element(self, value):
        """Add a new prediction confidence score to the window."""
        self.window.append(value)
        self.total_seen += 1
        
        if len(self.window) < self.min_window * 2:
            return False
        
        # Check for drift by comparing sub-windows
        return self._detect_change()
    
    def _detect_change(self):
        """ADWIN-style: find the cut point that maximizes drift signal."""
        window_list = list(self.window)
        n = len(window_list)
        
        for cut in range(self.min_window, n - self.min_window):
            w0 = np.array(window_list[:cut])
            w1 = np.array(window_list[cut:])
            
            n0, n1 = len(w0), len(w1)
            mu0, mu1 = np.mean(w0), np.mean(w1)
            
            # Hoeffding bound
            m = 1.0 / (1.0 / n0 + 1.0 / n1)
            epsilon = np.sqrt((1.0 / (2.0 * m)) * np.log(4.0 / self.delta))
            
            if abs(mu0 - mu1) >= epsilon:
                # Drift detected — shrink window
                self.drift_points.append({
                    'total_seen': self.total_seen,
                    'window_size': n,
                    'cut_point': cut,
                    'mean_before': round(float(mu0), 4),
                    'mean_after': round(float(mu1), 4),
                    'shift': round(float(mu1 - mu0), 4),
                    'timestamp': datetime.utcnow().isoformat()
                })
                
                # Remove old part of window (ADWIN shrinkage)
                for _ in range(cut):
                    self.window.popleft()
                
                return True
        
        return False
    
    def get_status(self):
        return {
            'window_size': len(self.window),
            'total_processed': self.total_seen,
            'n_drifts_detected': len(self.drift_points),
            'drift_points': self.drift_points[-5:],  # Last 5
            'current_mean': round(float(np.mean(list(self.window))), 4) if self.window else None,
            'current_std': round(float(np.std(list(self.window))), 4) if self.window else None,
        }


def population_stability_index(expected, actual, n_bins=10):
    """
    Population Stability Index (PSI) — measures how much a feature
    distribution has shifted between two time periods.
    
    PSI < 0.1: No significant shift
    PSI 0.1-0.25: Moderate shift (monitor)
    PSI > 0.25: Significant shift (retrain!)
    """
    # Create bins from expected distribution
    breakpoints = np.percentile(expected, np.linspace(0, 100, n_bins + 1))
    breakpoints = np.unique(breakpoints)
    
    if len(breakpoints) < 3:
        return 0.0
    
    expected_counts = np.histogram(expected, bins=breakpoints)[0]
    actual_counts = np.histogram(actual, bins=breakpoints)[0]
    
    # Normalize to proportions (add small value to avoid log(0))
    expected_pct = (expected_counts + 1) / (len(expected) + n_bins)
    actual_pct = (actual_counts + 1) / (len(actual) + n_bins)
    
    psi = np.sum((actual_pct - expected_pct) * np.log(actual_pct / expected_pct))
    return round(float(psi), 6)


def ks_drift_test(reference, current, alpha=0.05):
    """
    Kolmogorov-Smirnov test for distribution shift.
    Returns (is_drift, p_value, ks_statistic)
    """
    ks_stat, p_value = stats.ks_2samp(reference, current)
    return {
        'is_drift': p_value < alpha,
        'ks_statistic': round(float(ks_stat), 4),
        'p_value': round(float(p_value), 6),
        'alpha': alpha
    }


def simulate_drift_scenario():
    """
    Simulate a realistic fraud drift scenario to demonstrate the detector.
    
    Scenario:
      Phase 1 (t=0-1000): Normal fraud rate ~5%, model performs well
      Phase 2 (t=1000-2000): New fraud pattern emerges, model confidence shifts
      Phase 3 (t=2000-3000): Fraud adapts further, severe drift
    """
    print("\n[SIM] Running drift simulation...")
    np.random.seed(42)
    
    detector = ADWINDriftDetector(delta=0.002)
    
    # Phase 1: Stable period — model confident
    print("   Phase 1: Stable (t=0-1000)...")
    phase1_scores = np.random.beta(8, 2, 1000)  # Most predictions high-confidence
    
    # Phase 2: Moderate drift — new fraud pattern
    print("   Phase 2: Moderate drift (t=1000-2000)...")
    phase2_scores = np.random.beta(5, 3, 1000)   # Confidence drops
    
    # Phase 3: Severe drift — model degradation
    print("   Phase 3: Severe drift (t=2000-3000)...")
    phase3_scores = np.random.beta(3, 4, 1000)    # Model confused
    
    all_scores = np.concatenate([phase1_scores, phase2_scores, phase3_scores])
    
    drift_events = []
    for i, score in enumerate(all_scores):
        drift_detected = detector.add_element(score)
        if drift_detected:
            drift_events.append(i)
            phase = "Phase 1" if i < 1000 else ("Phase 2" if i < 2000 else "Phase 3")
            print(f"   [DRIFT] Detected at t={i} ({phase})")
    
    # PSI analysis
    print("\n[PSI] Feature Stability Analysis:")
    psi_12 = population_stability_index(phase1_scores, phase2_scores)
    psi_13 = population_stability_index(phase1_scores, phase3_scores)
    psi_23 = population_stability_index(phase2_scores, phase3_scores)
    
    print(f"   Phase 1 vs 2: PSI = {psi_12:.4f} {'(SHIFT!)' if psi_12 > 0.1 else '(stable)'}")
    print(f"   Phase 1 vs 3: PSI = {psi_13:.4f} {'(SHIFT!)' if psi_13 > 0.1 else '(stable)'}")
    print(f"   Phase 2 vs 3: PSI = {psi_23:.4f} {'(SHIFT!)' if psi_23 > 0.1 else '(stable)'}")
    
    # KS test
    print("\n[KS] Kolmogorov-Smirnov Drift Tests:")
    ks_12 = ks_drift_test(phase1_scores, phase2_scores)
    ks_13 = ks_drift_test(phase1_scores, phase3_scores)
    print(f"   Phase 1 vs 2: KS={ks_12['ks_statistic']}, p={ks_12['p_value']}, drift={ks_12['is_drift']}")
    print(f"   Phase 1 vs 3: KS={ks_13['ks_statistic']}, p={ks_13['p_value']}, drift={ks_13['is_drift']}")
    
    return detector, {
        'n_drifts_detected': len(drift_events),
        'drift_timestamps': drift_events,
        'psi': {'phase1_vs_2': psi_12, 'phase1_vs_3': psi_13, 'phase2_vs_3': psi_23},
        'ks_tests': {'phase1_vs_2': ks_12, 'phase1_vs_3': ks_13},
        'recommendation': (
            "RETRAIN" if psi_13 > 0.25 else
            "MONITOR" if psi_12 > 0.1 else
            "STABLE"
        )
    }


def analyze_real_predictions():
    """Analyze drift on actual model predictions if available."""
    stats_path = f"{MODEL_DIR}/model_stats_v2.json"
    if not os.path.exists(stats_path):
        return None
    
    print("\n[*] Analyzing real model predictions for drift signals...")
    
    with open(stats_path, 'r') as f:
        model_stats = json.load(f)
    
    # Check if hourly fraud rates show temporal patterns
    hourly = model_stats.get('hourly', [])
    if hourly:
        rates = [h.get('fraudRate', 0) for h in hourly]
        night_rates = rates[:6] + rates[22:]  # 22:00-05:00
        day_rates = rates[8:20]
        
        if night_rates and day_rates:
            ks = ks_drift_test(night_rates, day_rates, alpha=0.1)
            print(f"   Night vs Day fraud rate drift: KS={ks['ks_statistic']}, drift={ks['is_drift']}")
    
    return True


def main():
    print("=" * 60)
    print("  FraudLens - Concept Drift Detection Module")
    print("  Addressing Real-World ML Production Challenges")
    print("=" * 60)
    
    # 1. Run simulation
    detector, sim_results = simulate_drift_scenario()
    
    # 2. Analyze real predictions
    analyze_real_predictions()
    
    # 3. Save results
    results = {
        'module': 'concept_drift_detector',
        'methods': ['ADWIN', 'PSI', 'KS-test'],
        'simulation_results': sim_results,
        'detector_status': detector.get_status(),
        'timestamp': datetime.utcnow().isoformat()
    }
    
    output_path = f"{MODEL_DIR}/drift_analysis.json"
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    # 4. Summary
    print(f"\n{'=' * 60}")
    print(f"  Concept Drift Analysis Summary")
    print(f"{'=' * 60}")
    print(f"  Drifts Detected:  {sim_results['n_drifts_detected']}")
    print(f"  PSI (P1 vs P3):   {sim_results['psi']['phase1_vs_3']:.4f}")
    print(f"  Recommendation:   {sim_results['recommendation']}")
    print(f"  Saved to:         {output_path}")
    print(f"\n[OK] Done!")


if __name__ == '__main__':
    main()
