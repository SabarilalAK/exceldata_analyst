import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const execPromise = promisify(exec);

/**
 * Extracts metadata from the uploaded CSV/Excel file using the python metadata reader.
 */
export async function getExcelMetadata(filePath) {
  const metadataScript = path.resolve('read_metadata.py');
  try {
    const { stdout, stderr } = await execPromise(`python "${metadataScript}" "${filePath}"`);
    if (stderr && !stdout) {
      throw new Error(stderr);
    }
    return JSON.parse(stdout);
  } catch (error) {
    console.error("Error reading excel metadata:", error);
    throw error;
  }
}

/**
 * Submits the schema and user query to Anthropic Claude to generate a python execution script,
 * then executes the script and returns the parsed result.
 */
export async function analyzeData(filePath, activeSheet, userQuery, history = []) {
  // 1. Get metadata to construct prompt context
  const metadata = await getExcelMetadata(filePath);
  
  if (metadata.error) {
    throw new Error(`Failed to read file: ${metadata.error}`);
  }
  
  const sheetMeta = metadata.sheets[activeSheet] || Object.values(metadata.sheets)[0];
  const columnsList = sheetMeta.columns;
  const dtypes = sheetMeta.dtypes;
  const preview = sheetMeta.preview;
  const rowCount = sheetMeta.rowCount;

  // 2. Format the chat history for the prompt
  const formattedHistory = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n');

  // 3. Build system prompt for Claude
  const systemPrompt = `You are an expert Python data analyst backend service.
Your task is to write a single, self-contained, and robust Python script to answer a user's natural language query about a spreadsheet.
The spreadsheet has a sheet named "${activeSheet}" with ${rowCount} rows.
Here is the schema of the spreadsheet sheet:
- Columns and Types: ${JSON.stringify(dtypes)}
- Sample Data Preview (First few rows): ${JSON.stringify(preview)}

Arguments passed to your script:
1. sys.argv[1]: Input file path (either Excel .xlsx or CSV)
2. sys.argv[2]: Output chart file path (where to save any generated plot as a PNG, e.g. "path/to/chart.png")

Your generated Python code must:
1. Read the input file path from sys.argv[1] (check file extension: if ends with .csv, use pd.read_csv; otherwise pd.read_excel(..., sheet_name="${activeSheet}")).
2. Clean column names (strip whitespace if needed) and parse dates if necessary using pd.to_datetime() with errors='coerce'.
3. Perform the analysis needed to answer the user query: "${userQuery}".
4. If the query asks for visualization/chart (e.g. bar chart, pie chart, line chart, outstanding balances, overdue distribution), generate a high-quality visualization and save it to the output path from sys.argv[2].
5. Output a structured JSON response enclosed between <RESULT_JSON> and </RESULT_JSON> tags printed directly to stdout.

Visualizations design guidelines (STRICT):
- Use matplotlib.use('Agg') at the very top of the script (before importing pyplot) to avoid UI window popups on the server.
- Use a premium dark-themed color palette to match a dark glassmorphic web UI:
  - Figure facecolor: '#12121e'
  - Axes facecolor: '#1a1a2e'
  - Grid lines: '#2d2d44', dashed, line width 0.5
  - Font color: '#e2e8f0' (axes titles, labels, tick labels)
  - Color palette: Use premium colors like teals, deep purples, neon pink, soft blues, and warm gold.
- Adjust layout: call plt.tight_layout() to prevent cut-off labels.
- Set dpi=150 in plt.savefig.
- Call plt.close('all') after saving to free memory.

Output JSON structure guidelines:
The JSON printed to stdout must look like:
{
  "text_response": "A detailed, friendly, and structured markdown response answering the user's query with key insights. Use bullet points or bold text to make it readable.",
  "table_data": [ {"Column1": "Value1", "Column2": 123}, ... ], // Optional list of objects representing a summary table (if the query results in tabular data)
  "table_columns": ["Column1", "Column2"], // Optional list of strings for table columns (matches the keys in table_data)
  "has_chart": true, // Set to true if a chart was generated and saved to sys.argv[2]
  "chart_type": "bar", // 'bar', 'pie', 'line', 'scatter', etc.
  "success": true,
  "error_message": null
}

If any exception occurs in your python execution code, catch it and output:
{
  "text_response": "I encountered an error during data processing.",
  "table_data": null,
  "table_columns": null,
  "has_chart": false,
  "success": false,
  "error_message": "details of the exception"
}

DO NOT print any other text to stdout outside of the <RESULT_JSON>...</RESULT_JSON> tags.
ONLY return executable Python code. Do not wrap the code in backticks or include any markdown explanations. Return the raw python code text directly.`;

  const userPrompt = `Chat History:
${formattedHistory}

User Query: ${userQuery}
Generate the Python script.`;

  // 4. Try calling Anthropic API
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let useFallback = false;
  let pythonCode = '';

  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY environment variable is not defined. Falling back to local data analyzer.");
    useFallback = true;
  } else {
    try {
      console.log(`Sending query to Claude: "${userQuery}"`);
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 4000,
          system: systemPrompt,
          messages: [
            { role: "user", content: userPrompt }
          ]
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Anthropic API returned status ${response.status}: ${errorText}. Using local fallback.`);
        useFallback = true;
      } else {
        const resJson = await response.json();
        pythonCode = resJson.content[0].text;
        
        // Clean python code if the LLM accidentally wrapped it in markdown code blocks
        if (pythonCode.includes("```python")) {
          pythonCode = pythonCode.split("```python")[1].split("```")[0];
        } else if (pythonCode.includes("```")) {
          pythonCode = pythonCode.split("```")[1].split("```")[0];
        }
        pythonCode = pythonCode.trim();
      }
    } catch (apiErr) {
      console.warn("Error calling Anthropic API, using local fallback. Details:", apiErr);
      useFallback = true;
    }
  }

  const scriptId = crypto.randomUUID();
  const chartFileName = `chart_${scriptId}.png`;
  const tempChartPath = path.resolve(`charts/${chartFileName}`);

  if (useFallback) {
    // Write a temporary JSON config
    const tempConfigPath = path.resolve(`temp/config_${scriptId}.json`);
    const fallbackScript = path.resolve('fallback_analyzer.py');
    
    await fs.promises.writeFile(tempConfigPath, JSON.stringify({
      filePath: filePath,
      chartPath: tempChartPath,
      query: userQuery,
      sheetName: activeSheet
    }), 'utf8');

    try {
      console.log(`Executing local fallback script for query: "${userQuery}"`);
      const { stdout, stderr } = await execPromise(`python "${fallbackScript}" "${tempConfigPath}"`);
      
      if (stderr && !stdout) {
        console.error("Fallback script stderr output:", stderr);
      }
      
      const jsonMatch = stdout.match(/<RESULT_JSON>([\s\S]*?)<\/RESULT_JSON>/);
      if (!jsonMatch) {
        console.error("Fallback script full stdout:", stdout);
        throw new Error("Could not find <RESULT_JSON> tags in fallback script output.");
      }

      const result = JSON.parse(jsonMatch[1].trim());

      // Clean up config file
      await fs.promises.unlink(tempConfigPath).catch(() => {});

      if (!result.success) {
        throw new Error(result.error_message || "Fallback script execution success=false");
      }

      return {
        textResponse: result.text_response,
        tableData: result.table_data,
        tableColumns: result.table_columns,
        hasChart: result.has_chart,
        chartUrl: result.has_chart ? `/api/charts/${chartFileName}` : null
      };

    } catch (error) {
      // Clean up config file
      await fs.promises.unlink(tempConfigPath).catch(() => {});
      // Clean up empty/corrupt chart file
      await fs.promises.unlink(tempChartPath).catch(() => {});
      console.error("Error executing local fallback script:", error);
      throw error;
    }
  } else {
    // 5. Run the python script generated by Claude
    const tempScriptPath = path.resolve(`temp/script_${scriptId}.py`);
    await fs.promises.writeFile(tempScriptPath, pythonCode, 'utf8');

    try {
      console.log(`Executing Claude generated script: ${tempScriptPath}`);
      const { stdout, stderr } = await execPromise(`python "${tempScriptPath}" "${filePath}" "${tempChartPath}"`);
      
      if (stderr && !stdout) {
        console.error("Python script stderr output:", stderr);
      }
      
      const jsonMatch = stdout.match(/<RESULT_JSON>([\s\S]*?)<\/RESULT_JSON>/);
      if (!jsonMatch) {
        console.error("Python full stdout:", stdout);
        throw new Error("Could not find <RESULT_JSON> tags in Python script output.");
      }

      const result = JSON.parse(jsonMatch[1].trim());

      // Clean up temporary script
      await fs.promises.unlink(tempScriptPath).catch(() => {});

      if (!result.success) {
        throw new Error(result.error_message || "Python code executed but returned success=false");
      }

      return {
        textResponse: result.text_response,
        tableData: result.table_data,
        tableColumns: result.table_columns,
        hasChart: result.has_chart,
        chartUrl: result.has_chart ? `/api/charts/${chartFileName}` : null
      };

    } catch (error) {
      await fs.promises.unlink(tempScriptPath).catch(() => {});
      await fs.promises.unlink(tempChartPath).catch(() => {});
      console.error("Error executing Python script:", error);
      throw error;
    }
  }
}
