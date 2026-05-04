import ast
import importlib.util
import os
from typing import Type
from app.strategies.sma_crossover import Strategy  # Default fallback or base class

class StrategyLoader:
    DANGEROUS_IMPORTS = {'os', 'sys', 'shutil', 'subprocess', 'requests', 'socket', 'urllib'}

    @classmethod
    def validate_strategy_code(cls, code: str) -> bool:
        """
        Performs static analysis on the strategy code to check for dangerous imports or operations.
        """
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                # Check for imports
                if isinstance(node, (ast.Import, ast.ImportFrom)):
                    for alias in node.names:
                        name = alias.name.split('.')[0]
                        if name in cls.DANGEROUS_IMPORTS:
                            raise ValueError(f"Dangerous import detected: {name}")
                
                # Check for calls to potentially dangerous functions
                if isinstance(node, ast.Call):
                    if isinstance(node.func, ast.Name):
                        if node.func.id in {'eval', 'exec', 'open'}:
                             raise ValueError(f"Dangerous function call detected: {node.func.id}")
            return True
        except Exception as e:
            print(f"Strategy validation failed: {e}")
            return False

    @classmethod
    def load_strategy_from_file(cls, file_path: str) -> Type:
        """
        Dynamically loads a strategy class from a file.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Strategy file not found: {file_path}")

        with open(file_path, 'r') as f:
            code = f.read()

        if not cls.validate_strategy_code(code):
            raise ValueError("Strategy failed security validation")

        spec = importlib.util.spec_from_file_location("strategy_module", file_path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)

        if not hasattr(module, 'Strategy'):
            raise ValueError("Strategy file must define a 'Strategy' class")

        return module.Strategy
