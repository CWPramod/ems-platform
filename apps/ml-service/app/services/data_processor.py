"""
Data processing utilities for ML pipeline
"""
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class DataProcessor:
    """Data processing and feature engineering for ML models"""
    
    @staticmethod
    def metrics_to_dataframe(metrics: List[Dict[str, Any]]) -> pd.DataFrame:
        """
        Convert metrics list to pandas DataFrame
        
        Args:
            metrics: List of metric dictionaries
        
        Returns:
            DataFrame with processed metrics
        """
        if not metrics:
            return pd.DataFrame()
        
        df = pd.DataFrame(metrics)
        
        # Convert timestamp to datetime
        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df = df.sort_values('timestamp')
        
        return df
    
    @staticmethod
    def create_time_features(df: pd.DataFrame) -> pd.DataFrame:
        """
        Create time-based features from timestamp
        
        Args:
            df: DataFrame with 'timestamp' column
        
        Returns:
            DataFrame with additional time features
        """
        if 'timestamp' not in df.columns:
            return df
        
        df = df.copy()
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        df['day_of_month'] = df['timestamp'].dt.day
        df['month'] = df['timestamp'].dt.month
        df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
        df['is_business_hours'] = df['hour'].between(9, 17).astype(int)
        
        return df
    
    @staticmethod
    def create_rolling_features(
        df: pd.DataFrame,
        column: str,
        windows: List[int] = [5, 10, 30, 60]
    ) -> pd.DataFrame:
        """
        Create rolling statistics features
        
        Args:
            df: Input DataFrame
            column: Column to compute rolling statistics on
            windows: List of window sizes
        
        Returns:
            DataFrame with rolling features
        """
        if column not in df.columns:
            return df
        
        df = df.copy()
        
        for window in windows:
            # Rolling mean
            df[f'{column}_rolling_mean_{window}'] = df[column].rolling(
                window=window, min_periods=1
            ).mean()
            
            # Rolling std
            df[f'{column}_rolling_std_{window}'] = df[column].rolling(
                window=window, min_periods=1
            ).std()
            
            # Rolling min/max
            df[f'{column}_rolling_min_{window}'] = df[column].rolling(
                window=window, min_periods=1
            ).min()
            
            df[f'{column}_rolling_max_{window}'] = df[column].rolling(
                window=window, min_periods=1
            ).max()
        
        return df
    
    @staticmethod
    def create_lag_features(
        df: pd.DataFrame,
        column: str,
        lags: List[int] = [1, 5, 10, 30]
    ) -> pd.DataFrame:
        """
        Create lag features
        
        Args:
            df: Input DataFrame
            column: Column to create lags for
            lags: List of lag periods
        
        Returns:
            DataFrame with lag features
        """
        if column not in df.columns:
            return df
        
        df = df.copy()
        
        for lag in lags:
            df[f'{column}_lag_{lag}'] = df[column].shift(lag)
        
        return df
    
    @staticmethod
    def detect_outliers_iqr(
        data: np.ndarray,
        multiplier: float = 1.5
    ) -> np.ndarray:
        """
        Detect outliers using IQR method
        
        Args:
            data: Input array
            multiplier: IQR multiplier (default 1.5)
        
        Returns:
            Boolean array indicating outliers
        """
        q1 = np.percentile(data, 25)
        q3 = np.percentile(data, 75)
        iqr = q3 - q1
        
        lower_bound = q1 - (multiplier * iqr)
        upper_bound = q3 + (multiplier * iqr)
        
        return (data < lower_bound) | (data > upper_bound)
    
    @staticmethod
    def normalize_data(
        data: np.ndarray,
        method: str = "minmax"
    ) -> Tuple[np.ndarray, Dict[str, float]]:
        """
        Normalize data
        
        Args:
            data: Input array
            method: Normalization method ('minmax' or 'zscore')
        
        Returns:
            Tuple of (normalized_data, normalization_params)
        """
        if method == "minmax":
            min_val = np.min(data)
            max_val = np.max(data)
            
            if max_val - min_val == 0:
                return data, {"min": min_val, "max": max_val}
            
            normalized = (data - min_val) / (max_val - min_val)
            return normalized, {"min": min_val, "max": max_val}
        
        elif method == "zscore":
            mean = np.mean(data)
            std = np.std(data)
            
            if std == 0:
                return data, {"mean": mean, "std": std}
            
            normalized = (data - mean) / std
            return normalized, {"mean": mean, "std": std}
        
        else:
            raise ValueError(f"Unknown normalization method: {method}")
    
    @staticmethod
    def handle_missing_values(
        df: pd.DataFrame,
        strategy: str = "forward_fill"
    ) -> pd.DataFrame:
        """
        Handle missing values in DataFrame
        
        Args:
            df: Input DataFrame
            strategy: Strategy to handle missing values
                     ('forward_fill', 'backward_fill', 'mean', 'median', 'drop')
        
        Returns:
            DataFrame with handled missing values
        """
        df = df.copy()
        
        if strategy == "forward_fill":
            df = df.fillna(method='ffill')
        elif strategy == "backward_fill":
            df = df.fillna(method='bfill')
        elif strategy == "mean":
            df = df.fillna(df.mean())
        elif strategy == "median":
            df = df.fillna(df.median())
        elif strategy == "drop":
            df = df.dropna()
        else:
            raise ValueError(f"Unknown strategy: {strategy}")
        
        return df
    
    @staticmethod
    def aggregate_metrics(
        df: pd.DataFrame,
        freq: str = "5min",
        agg_funcs: Optional[Dict[str, List[str]]] = None
    ) -> pd.DataFrame:
        """
        Aggregate metrics by time frequency
        
        Args:
            df: Input DataFrame with 'timestamp' column
            freq: Aggregation frequency (e.g., '5min', '1H', '1D')
            agg_funcs: Dictionary mapping column names to aggregation functions
        
        Returns:
            Aggregated DataFrame
        """
        if 'timestamp' not in df.columns:
            return df
        
        df = df.copy()
        df = df.set_index('timestamp')
        
        if agg_funcs is None:
            # Default aggregation: mean for numeric columns
            numeric_cols = df.select_dtypes(include=[np.number]).columns
            agg_funcs = {col: ['mean', 'std', 'min', 'max'] for col in numeric_cols}
        
        aggregated = df.resample(freq).agg(agg_funcs)
        aggregated = aggregated.reset_index()
        
        return aggregated
    
    @staticmethod
    def calculate_statistics(data: np.ndarray) -> Dict[str, float]:
        """
        Calculate comprehensive statistics for data
        
        Args:
            data: Input array
        
        Returns:
            Dictionary with statistical measures
        """
        if len(data) == 0:
            return {}
        
        return {
            "mean": float(np.mean(data)),
            "median": float(np.median(data)),
            "std": float(np.std(data)),
            "min": float(np.min(data)),
            "max": float(np.max(data)),
            "q25": float(np.percentile(data, 25)),
            "q75": float(np.percentile(data, 75)),
            "count": len(data),
            "variance": float(np.var(data)),
            "skewness": float(pd.Series(data).skew()) if len(data) > 2 else 0.0,
            "kurtosis": float(pd.Series(data).kurtosis()) if len(data) > 3 else 0.0
        }
    
    @staticmethod
    def prepare_sequences(
        data: np.ndarray,
        sequence_length: int,
        prediction_length: int = 1
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare sequences for time-series prediction
        
        Args:
            data: Input time-series data
            sequence_length: Length of input sequences
            prediction_length: Length of prediction (default 1)
        
        Returns:
            Tuple of (X, y) where X is input sequences and y is target values
        """
        X, y = [], []
        
        for i in range(len(data) - sequence_length - prediction_length + 1):
            X.append(data[i:i + sequence_length])
            
            if prediction_length == 1:
                y.append(data[i + sequence_length])
            else:
                y.append(data[i + sequence_length:i + sequence_length + prediction_length])
        
        return np.array(X), np.array(y)
    
    @staticmethod
    def detect_seasonality(
        data: np.ndarray,
        period: int = 24
    ) -> Dict[str, Any]:
        """
        Detect seasonality in time-series data
        
        Args:
            data: Input time-series data
            period: Expected seasonality period
        
        Returns:
            Dictionary with seasonality information
        """
        if len(data) < 2 * period:
            return {"has_seasonality": False, "period": None, "strength": 0.0}
        
        # Calculate autocorrelation at the period
        from scipy import signal
        
        autocorr = signal.correlate(data, data, mode='full')
        autocorr = autocorr[len(autocorr) // 2:]
        autocorr = autocorr / autocorr[0]  # Normalize
        
        if len(autocorr) > period:
            seasonal_strength = autocorr[period]
            has_seasonality = seasonal_strength > 0.5
            
            return {
                "has_seasonality": bool(has_seasonality),
                "period": period if has_seasonality else None,
                "strength": float(seasonal_strength)
            }
        
        return {"has_seasonality": False, "period": None, "strength": 0.0}
