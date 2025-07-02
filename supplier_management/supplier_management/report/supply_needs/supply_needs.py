# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
    columns, data = get_columns(), get_data(filters)
    return columns, data


def get_columns():
    columns = [
        {
            "label": _("Item"),
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 120,
        },
        {
            "label": _("Warehouse"),
            "fieldname": "warehouse",
            "fieldtype": "Link",
            "options": "Warehouse",
            "width": 120,
        },
        {
            "label": _("Supplier"),
            "fieldname": "supplier",
            "fieldtype": "Link",
            "options": "Supplier",
            "width": 120,
        },
        {
            "label": _("Available Qty"),
            "fieldname": "actual_qty",
            "fieldtype": "Float",
            "width": 150,
        },
        {
            "label": _("Suggested Qty To Order"),
            "fieldname": "projected_qty",
            "fieldtype": "Float",
            "width": 220,
            "editable": 1,
        },
        {
            "label": _("Required Qty"),
            "fieldname": "reserved_qty",
            "fieldtype": "Float",
            "width": 150,
        },
        {
            "label": _("Receivable Qty"),
            "fieldname": "indented_qty",
            "fieldtype": "Float",
            "width": 150,
        },
        {
            "label": _("Ordered"),
            "fieldname": "ordered_qty",
            "fieldtype": "Float",
            "width": 90,
        },
    ]
    return columns


def get_data(filters):
    bin_table = frappe.qb.DocType("Bin")
    item_table = frappe.qb.DocType("Item")
    supplier_item_table = frappe.qb.DocType("Item Supplier")

    # Update the join condition based on the actual column in the Item Supplier table
    query = (
        frappe.qb.from_(bin_table)
        .inner_join(item_table)
        .on(bin_table.item_code == item_table.name)
        .left_join(supplier_item_table)
        .on(
            item_table.name == supplier_item_table.parent
        )  # Adjust based on actual column
        .select(
            bin_table.item_code,
            bin_table.warehouse,
            supplier_item_table.supplier,
            bin_table.actual_qty,
            bin_table.indented_qty,
            bin_table.reserved_qty,
            bin_table.ordered_qty,
            bin_table.projected_qty,
        )
        .where(bin_table.projected_qty < 0)
        .orderby(bin_table.projected_qty)
    )

    # Apply filters
    if filters.get("item_code"):
        query = query.where(bin_table.item_code == filters.get("item_code"))

    if filters.get("warehouse"):
        query = query.where(bin_table.warehouse == filters.get("warehouse"))

    if filters.get("supplier"):
        query = query.where(supplier_item_table.supplier == filters.get("supplier"))

    # Fetch the query result
    result = query.run(as_dict=1)

    # Check for duplicate item_code
    item_code_map = {}
    for row in result:
        item_code = row.get("item_code")
        supplier = row.get("supplier") or "Unknown Supplier"
        if item_code:
            if item_code in item_code_map:
                item_code_map[item_code].append(supplier)
            else:
                item_code_map[item_code] = [supplier]

    # Find duplicates
    duplicates = {
        item: suppliers
        for item, suppliers in item_code_map.items()
        if len(suppliers) > 1
    }

    if duplicates:
        # Prepare the message content
        message = "<br>".join(
            [
                f"{item} => {', '.join(suppliers)}"
                for item, suppliers in duplicates.items()
            ]
        )

        # Show the popup message
        frappe.msgprint(
            title=_("Duplicate Item Codes"),
            msg=_("The following item codes have multiple suppliers:<br>{0}").format(
                message
            ),
            indicator="orange",
        )

    return result
