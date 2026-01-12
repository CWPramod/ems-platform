import pickle
import os
import json
from datetime import datetime
from typing import Optional, Dict, Any, List
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ModelStorage:
    """
    Service to save and load trained ML models with metadata.
    """
    
    def __init__(self, models_dir: str = "models"):
        self.models_dir = models_dir
        
        # Create models directory if it doesn't exist
        if not os.path.exists(models_dir):
            os.makedirs(models_dir)
            logger.info(f"Created models directory: {models_dir}")
    
    def save_model(
        self,
        model: Any,
        model_name: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Save a trained model to disk with metadata.
        
        Args:
            model: The trained model object
            model_name: Name for the model (e.g., 'cpu_anomaly_detector')
            metadata: Optional metadata dict
            
        Returns:
            Path to saved model file
        """
        try:
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            filename = f"{model_name}_{timestamp}.pkl"
            filepath = os.path.join(self.models_dir, filename)
            
            # Save model
            with open(filepath, 'wb') as f:
                pickle.dump(model, f)
            
            logger.info(f"Model saved: {filepath}")
            
            # Save metadata
            if metadata:
                metadata['saved_at'] = datetime.utcnow().isoformat()
                metadata['model_file'] = filename
                metadata_path = filepath.replace('.pkl', '_metadata.json')
                
                with open(metadata_path, 'w') as f:
                    json.dump(metadata, f, indent=2)
                
                logger.info(f"Metadata saved: {metadata_path}")
            
            # Create/update 'latest' symlink
            latest_path = os.path.join(self.models_dir, f"{model_name}_latest.pkl")
            
            # Remove old latest file if exists
            if os.path.exists(latest_path):
                os.remove(latest_path)
            
            # Copy to latest (Windows doesn't support symlinks easily)
            with open(filepath, 'rb') as src:
                with open(latest_path, 'wb') as dst:
                    dst.write(src.read())
            
            logger.info(f"Latest model updated: {latest_path}")
            
            return filepath
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")
            raise
    
    def load_model(
        self,
        model_name: str,
        version: Optional[str] = None
    ) -> Optional[Any]:
        """
        Load a trained model from disk.
        
        Args:
            model_name: Name of the model
            version: Specific version timestamp or 'latest' (default)
            
        Returns:
            Loaded model object or None
        """
        try:
            if version and version != 'latest':
                filename = f"{model_name}_{version}.pkl"
            else:
                filename = f"{model_name}_latest.pkl"
            
            filepath = os.path.join(self.models_dir, filename)
            
            if not os.path.exists(filepath):
                logger.warning(f"Model file not found: {filepath}")
                return None
            
            with open(filepath, 'rb') as f:
                model = pickle.load(f)
            
            logger.info(f"Model loaded: {filepath}")
            return model
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return None
    
    def load_metadata(
        self,
        model_name: str,
        version: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Load model metadata.
        
        Args:
            model_name: Name of the model
            version: Specific version or 'latest'
            
        Returns:
            Metadata dict or None
        """
        try:
            if version and version != 'latest':
                filename = f"{model_name}_{version}_metadata.json"
            else:
                # Find latest metadata
                files = os.listdir(self.models_dir)
                metadata_files = [f for f in files if f.startswith(model_name) and f.endswith('_metadata.json')]
                
                if not metadata_files:
                    return None
                
                # Sort by timestamp (most recent first)
                metadata_files.sort(reverse=True)
                filename = metadata_files[0]
            
            filepath = os.path.join(self.models_dir, filename)
            
            if not os.path.exists(filepath):
                return None
            
            with open(filepath, 'r') as f:
                metadata = json.load(f)
            
            return metadata
            
        except Exception as e:
            logger.error(f"Error loading metadata: {e}")
            return None
    
    def list_models(self) -> List[Dict[str, Any]]:
        """
        List all saved models.
        
        Returns:
            List of model info dicts
        """
        try:
            models = []
            files = os.listdir(self.models_dir)
            
            # Get all .pkl files (excluding 'latest')
            pkl_files = [f for f in files if f.endswith('.pkl') and 'latest' not in f]
            
            for pkl_file in pkl_files:
                model_info = {
                    'filename': pkl_file,
                    'filepath': os.path.join(self.models_dir, pkl_file),
                    'size_bytes': os.path.getsize(os.path.join(self.models_dir, pkl_file))
                }
                
                # Try to load metadata
                metadata_file = pkl_file.replace('.pkl', '_metadata.json')
                metadata_path = os.path.join(self.models_dir, metadata_file)
                
                if os.path.exists(metadata_path):
                    with open(metadata_path, 'r') as f:
                        model_info['metadata'] = json.load(f)
                
                models.append(model_info)
            
            # Sort by filename (most recent first due to timestamp)
            models.sort(key=lambda x: x['filename'], reverse=True)
            
            return models
            
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []
    
    def delete_model(self, model_name: str, version: str) -> bool:
        """
        Delete a specific model version.
        
        Args:
            model_name: Name of the model
            version: Version timestamp
            
        Returns:
            True if deleted successfully
        """
        try:
            filename = f"{model_name}_{version}.pkl"
            filepath = os.path.join(self.models_dir, filename)
            
            if os.path.exists(filepath):
                os.remove(filepath)
                logger.info(f"Deleted model: {filepath}")
                
                # Also delete metadata
                metadata_path = filepath.replace('.pkl', '_metadata.json')
                if os.path.exists(metadata_path):
                    os.remove(metadata_path)
                    logger.info(f"Deleted metadata: {metadata_path}")
                
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error deleting model: {e}")
            return False

# Global model storage instance
model_storage = ModelStorage()