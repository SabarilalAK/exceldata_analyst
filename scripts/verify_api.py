import urllib.request
import json

BASE_URL = "http://localhost:5000/api"

def test_queries():
    filename = "mock_invoices.xlsx"
    active_sheet = "Invoices"
    
    queries = [
        "Calculate total invoiced, paid and outstanding amounts.",
        "Identify the top 10 customers by total invoice value.",
        "Generate a bar chart of invoice status — Paid, Partially Paid, Unpaid, Overdue, etc.",
        "Generate a pie chart based on overdue-day ranges.",
        "Identify customers with the highest outstanding balances.",
        "Compare invoice values across different categories."
    ]

    print("=== Testing AI Excel Data Analyst API Endpoints ===")
    
    for i, q in enumerate(queries, 1):
        print(f"\n[{i}/{len(queries)}] Query: '{q}'")
        payload = json.dumps({
            "filename": filename,
            "activeSheet": active_sheet,
            "query": q,
            "history": []
        }).encode('utf-8')

        req = urllib.request.Request(
            f"{BASE_URL}/query",
            data=payload,
            headers={'Content-Type': 'application/json'}
        )

        try:
            with urllib.request.urlopen(req) as response:
                res_body = response.read().decode('utf-8')
                res_json = json.loads(res_body)
                
                print(f"  Status: SUCCESS")
                print(f"  Has Chart: {res_json.get('hasChart')}")
                if res_json.get('chartUrl'):
                    print(f"  Chart URL: {res_json.get('chartUrl')}")
                if res_json.get('tableData'):
                    print(f"  Table Rows Returned: {len(res_json['tableData'])}")
                print(f"  Response Preview: {res_json['textResponse'][:120]}...")
        except Exception as e:
            print(f"  FAILED with error: {e}")

if __name__ == "__main__":
    test_queries()
