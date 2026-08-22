import pandas as pd
import json
import sys
import os

def extract_metadata(file_path):
    try:
        if not os.path.exists(file_path):
            return {"error": "File does not exist"}
        
        # Check if file is csv or excel
        if file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
            # Limit rows for preview
            preview_df = df.head(10).copy()
            # Convert datetime-like objects or others to string
            for col in preview_df.columns:
                if preview_df[col].dtype == 'object':
                    # Check if date-like
                    try:
                        preview_df[col] = pd.to_datetime(preview_df[col]).dt.strftime('%Y-%m-%d')
                    except:
                        pass
                elif pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                    preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d')
                
                # Handle nan
                preview_df[col] = preview_df[col].fillna('')
            
            # Columns and data types
            dtypes = {col: str(df[col].dtype) for col in df.columns}
            
            metadata = {
                "sheets": {
                    "Sheet1": {
                        "columns": list(df.columns),
                        "dtypes": dtypes,
                        "rowCount": len(df),
                        "preview": preview_df.to_dict(orient="records")
                    }
                },
                "defaultSheet": "Sheet1"
            }
            return metadata
        else:
            xl = pd.ExcelFile(file_path)
            sheets_data = {}
            for sheet in xl.sheet_names:
                df = pd.read_excel(file_path, sheet_name=sheet)
                preview_df = df.head(10).copy()
                
                # Clean columns for json serialization
                for col in preview_df.columns:
                    if pd.api.types.is_datetime64_any_dtype(preview_df[col]):
                        preview_df[col] = preview_df[col].dt.strftime('%Y-%m-%d')
                    elif preview_df[col].dtype == 'object':
                        # Try to format dates
                        try:
                            # only if format is datetime
                            preview_df[col] = pd.to_datetime(preview_df[col]).dt.strftime('%Y-%m-%d')
                        except:
                            pass
                    # Replace NaN, NaT, Infinity
                    preview_df[col] = preview_df[col].fillna('').replace([float('inf'), float('-inf')], '')
                
                dtypes = {col: str(df[col].dtype) for col in df.columns}
                
                sheets_data[sheet] = {
                    "columns": list(df.columns),
                    "dtypes": dtypes,
                    "rowCount": len(df),
                    "preview": preview_df.to_dict(orient="records")
                }
            
            return {
                "sheets": sheets_data,
                "defaultSheet": xl.sheet_names[0]
            }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)
    
    file_path = sys.argv[1]
    metadata = extract_metadata(file_path)
    print(json.dumps(metadata))
