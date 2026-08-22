import pandas as pd
import numpy as np
import datetime
import random
import os

def generate_data(num_rows=5000, output_path="mock_invoices.xlsx"):
    print(f"Generating {num_rows} rows of mock invoice data...")
    
    # 1. Custom list of customers
    customers = [
        "Acme Corp", "Globex Corporation", "Stark Industries", "Wayne Enterprises", 
        "Initech LLC", "Umbrella Corp", "Cyberdyne Systems", "Hooli Inc", 
        "Vehement Capital", "Soylent Corp", "Tyrell Corp", "Oscorp Industries", 
        "Gekko & Co", "Sterling Cooper", "Dunder Mifflin", "Prestige Worldwide", 
        "Entertainment 720", "Vandelay Industries", "Bluth Company", "Central Perk", 
        "Wonka Industries", "Massive Dynamic", "Goliath National Bank", "Pied Piper", 
        "Aperture Science", "LexCorp", "Krieger Enterprises", "Spacely Sprockets",
        "Cogswell Cogs", "Sledge Hammer Inc", "Halibut & Co", "Virtucon",
        "Initrode", "Saturdays LLC", "Reynholm Industries", "Wernham Hogg",
        "Avanade", "Contoso", "Northwind Traders", "Adventure Works"
    ]
    
    categories = [
        "Software License", "Cloud Infrastructure", "Professional Services", 
        "Hardware Purchase", "SaaS Subscription", "Maintenance & Support"
    ]
    
    # Anchor date for "today"
    today = datetime.date(2026, 8, 22)
    
    data = []
    
    random.seed(42)
    np.random.seed(42)
    
    for i in range(num_rows):
        invoice_id = f"INV-2025-{10000 + i}" if i < num_rows * 0.4 else f"INV-2026-{10000 + i}"
        customer = random.choice(customers)
        category = random.choice(categories)
        
        # Invoiced Date: spread over the last 14 months
        days_ago = random.randint(0, 420)
        invoice_date = today - datetime.timedelta(days=days_ago)
        
        # Payment term: 15, 30, or 45 days
        term = random.choice([15, 30, 45])
        due_date = invoice_date + datetime.timedelta(days=term)
        
        # Invoice amount: log-normal distribution to look realistic
        invoice_amount = round(float(np.random.lognormal(mean=8.0, sigma=1.0) + 100), 2)
        
        # Determine status base
        is_past_due = today > due_date
        
        # Randomly choose payment behavior
        if is_past_due:
            # For past due invoices, they could be fully paid, overdue, or partially paid
            prob = random.random()
            if prob < 0.65:
                status = "Paid"
                amount_paid = invoice_amount
            elif prob < 0.85:
                status = "Overdue"
                amount_paid = 0.0
            else:
                status = "Overdue" # Partially paid but past due is overdue
                amount_paid = round(invoice_amount * random.choice([0.1, 0.25, 0.5, 0.75]), 2)
        else:
            # For future due invoices, they could be unpaid, partially paid, or paid early
            prob = random.random()
            if prob < 0.15:
                status = "Paid"
                amount_paid = invoice_amount
            elif prob < 0.35:
                status = "Partially Paid"
                amount_paid = round(invoice_amount * random.choice([0.2, 0.4, 0.6]), 2)
            else:
                status = "Unpaid"
                amount_paid = 0.0
                
        outstanding_balance = round(invoice_amount - amount_paid, 2)
        
        # Correction in status: if paid in full, it's paid
        if outstanding_balance <= 0.0:
            status = "Paid"
            outstanding_balance = 0.0
            amount_paid = invoice_amount
            
        # Overdue days calculation
        if status == "Overdue" or (is_past_due and outstanding_balance > 0):
            overdue_days = (today - due_date).days
            if outstanding_balance > 0:
                status = "Overdue"
            else:
                status = "Paid"
                overdue_days = 0
        else:
            overdue_days = 0
            
        # Reformat dates to strings for excel readability
        data.append({
            "Invoice ID": invoice_id,
            "Customer Name": customer,
            "Invoice Date": invoice_date.strftime("%Y-%m-%d"),
            "Due Date": due_date.strftime("%Y-%m-%d"),
            "Category": category,
            "Invoice Amount": invoice_amount,
            "Amount Paid": amount_paid,
            "Outstanding Balance": outstanding_balance,
            "Status": status,
            "Overdue Days": overdue_days
        })
        
    df = pd.DataFrame(data)
    
    # Save to Excel
    df.to_excel(output_path, index=False, sheet_name="Invoices")
    print(f"Dataset successfully created and saved to {output_path}!")

if __name__ == "__main__":
    # If run directly, save in current directory or a relative path
    generate_data(num_rows=5000, output_path="../backend/uploads/mock_invoices.xlsx")
