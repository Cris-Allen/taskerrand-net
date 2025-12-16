#!/usr/bin/env python3
"""
Migration script to add profile fields to existing User table.
Run this script if you have an existing database that needs the new columns.
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
from sqlalchemy import text

def add_profile_columns():
    """Add profile-related columns to the users table if they don't exist"""
    print("Checking and adding profile columns to users table...")
    
    with engine.connect() as conn:
        # Add first_name column if it doesn't exist
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN first_name VARCHAR(190) NULL AFTER name;"))
            print("✓ Added first_name column to users table")
        except Exception as e:
            if "Duplicate column" in str(e) or "already exists" in str(e).lower():
                print("- first_name column already exists, skipping")
            else:
                print(f"⚠ Warning adding first_name column: {e}")
        
        # Add last_name column if it doesn't exist
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN last_name VARCHAR(190) NULL AFTER first_name;"))
            print("✓ Added last_name column to users table")
        except Exception as e:
            if "Duplicate column" in str(e) or "already exists" in str(e).lower():
                print("- last_name column already exists, skipping")
            else:
                print(f"⚠ Warning adding last_name column: {e}")
        
        # Add address column if it doesn't exist
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN address TEXT NULL AFTER last_name;"))
            print("✓ Added address column to users table")
        except Exception as e:
            if "Duplicate column" in str(e) or "already exists" in str(e).lower():
                print("- address column already exists, skipping")
            else:
                print(f"⚠ Warning adding address column: {e}")
                
        # Add contact_number column if it doesn't exist
        try:
            conn.execute(text("ALTER TABLE users ADD COLUMN contact_number VARCHAR(64) NULL AFTER address;"))
            print("✓ Added contact_number column to users table")
        except Exception as e:
            if "Duplicate column" in str(e) or "already exists" in str(e).lower():
                print("- contact_number column already exists, skipping")
            else:
                print(f"⚠ Warning adding contact_number column: {e}")
        
        conn.commit()
    
    print("\nProfile columns migration completed!")

if __name__ == "__main__":
    add_profile_columns()