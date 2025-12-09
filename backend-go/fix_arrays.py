#!/usr/bin/env python3
"""
Fix PostgreSQL array syntax in SQL dump:
  ARRAY["tag1","tag2"] → ARRAY['tag1','tag2']
"""
import re
import sys

def fix_array_syntax(line):
    """Replace double quotes with single quotes inside ARRAY[...] and escape apostrophes"""
    # Pattern: ARRAY["value1","value2",...]
    def replacer(match):
        content = match.group(1)  # Extract content inside ARRAY[...]
        
        # Split by "," to get individual values
        # This regex matches quoted values accounting for commas inside quotes
        values = re.findall(r'"([^"]*)"', content)
        
        # Escape single quotes in each value by doubling them
        escaped_values = ["'{}'".format(v.replace("'", "''")) for v in values]
        
        return "ARRAY[{}]".format(','.join(escaped_values))

    # Match ARRAY[...] blocks
    pattern = r'ARRAY\[([^\]]+)\]'
    return re.sub(pattern, replacer, line)

def main():
    input_file = 'backend-go/initial_data/articles_rows.sql'
    output_file = 'backend-go/initial_data/articles_rows_fixed.sql'

    print(f"Reading {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    print("Fixing array syntax...")
    fixed_content = fix_array_syntax(content)

    print(f"Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(fixed_content)

    print("✅ Done! Fixed arrays with single quotes.")
    print(f"\nTo import: docker exec esportnews-db psql -U postgres -d esportnews -f /tmp/articles_rows_fixed.sql")

if __name__ == '__main__':
    main()
