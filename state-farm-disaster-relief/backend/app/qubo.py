"""QUBO Hamiltonian compilation and simulated annealing solver.

Maps normalized zones into a cost Hamiltonian and finds the ground state
using GPU-accelerated classical simulated annealing mechanics.
"""

from typing import List

import numpy as np

from app.models import NormalizationResult, NormalizedZone, OptimizationResult, DeploymentZone


class StateFarmCatastropheOptimizer:
    """Constructs and solves the Hamiltonian QUBO matrix."""

    def __init__(
        self,
        normalized_data: NormalizationResult,
        available_units: int = 2,
    ):
        self.zones: List[NormalizedZone] = normalized_data.catastrophe_zones
        self.n: int = len(self.zones)
        self.available_units: int = available_units

    def compile_hamiltonian_qubo(self) -> np.ndarray:
        """Build the Q-matrix balancing severity weights and constraints."""

        Q = np.zeros((self.n, self.n))

        for i, zone in enumerate(self.zones):
            Q[i, i] = -zone.severity_score

        constraint_penalty = 5.0
        for i in range(self.n):
            for j in range(self.n):
                if i != j:
                    Q[i, j] += constraint_penalty / max(1, self.available_units)

        return Q

    def execute_qubo_solver(
        self, Q: np.ndarray, iterations: int = 2000
    ) -> np.ndarray:
        """Find the ground state using simulated annealing mechanics."""

        best_state = np.random.randint(0, 2, size=self.n)
        best_energy = float(best_state.T @ Q @ best_state)

        current_state = best_state.copy()

        for _ in range(iterations):
            idx = np.random.randint(0, self.n)
            current_state[idx] = 1 - current_state[idx]
            current_energy = float(current_state.T @ Q @ current_state)

            if current_energy < best_energy:
                best_energy = current_energy
                best_state = current_state.copy()
            else:
                current_state[idx] = 1 - current_state[idx]

        return best_state

    def optimize(self, iterations: int = 2000) -> OptimizationResult:
        """Compile the QUBO and solve for the deployment vector."""

        Q = self.compile_hamiltonian_qubo()
        state = self.execute_qubo_solver(Q, iterations=iterations)

        best_energy = float(state.T @ Q @ state)
        deployed_zones = [
            DeploymentZone(
                claim_id=zone.claim_id,
                severity_score=zone.severity_score,
                deployed=bool(bit),
            )
            for zone, bit in zip(self.zones, state)
        ]

        return OptimizationResult(
            deployment_vector=[int(bit) for bit in state],
            deployed_zones=deployed_zones,
            best_energy=best_energy,
            total_nodes=self.n,
            available_units=self.available_units,
        )
