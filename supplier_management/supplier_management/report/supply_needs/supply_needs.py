# Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import cint, flt


def execute(filters=None):
    columns = get_columns()
    data, total_count, selling_price_list = get_data(filters)
    message = {
        "total_count": total_count,
        "selling_price_list": selling_price_list,
        "filter_options": get_filter_options(),
    }
    return columns, data, message


def get_columns():
    columns = [
        {
            "label": _("Image"),
            "fieldname": "image",
            "fieldtype": "Data",
            "width": 100,
        },
        {
            "label": _("Item"),
            "fieldname": "item_code",
            "fieldtype": "Link",
            "options": "Item",
            "width": 120,
        },
        {
            "label": _("Item Name"),
            "fieldname": "item_name",
            "fieldtype": "Data",
            "width": 180,
        },
        {
            "label": _("Collection"),
            "fieldname": "custom_collection",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": _("Finition"),
            "fieldname": "custom_finition",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": _("Type Of Product"),
            "fieldname": "custom_type_de_produit",
            "fieldtype": "Data",
            "width": 140,
        },
        {
            "label": _("Brand"),
            "fieldname": "brand",
            "fieldtype": "Link",
            "options": "Brand",
            "width": 120,
        },
        {
            "label": _("Warehouse"),
            "fieldname": "warehouse",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": _("Supplier"),
            "fieldname": "supplier",
            "fieldtype": "Data",
            "width": 120,
        },
        {
            "label": _("Price"),
            "fieldname": "price",
            "fieldtype": "Currency",
            "options": "price_currency",
            "width": 120,
        },
        {
            "label": _("Available Qty"),
            "fieldname": "actual_qty",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": _("Backorder Qty"),
            "fieldname": "projected_qty",
            "fieldtype": "Data",
            "width": 220,
            "editable": 1,
        },
        {
            "label": _("Required Qty"),
            "fieldname": "reserved_qty",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": _("Requested Qty"),
            "fieldname": "indented_qty",
            "fieldtype": "Data",
            "width": 150,
        },
        {
            "label": _("Receivable Qty"),
            "fieldname": "ordered_qty",
            "fieldtype": "Data",
            "width": 150,
        },
    ]
    return columns


def get_data(filters):
    filters = filters or {}
    page_length = cint(filters.get("_page_length")) or 50
    page_start = max(cint(filters.get("_page_start")), 0)
    page_length = min(page_length, 500)
    selling_price_list = get_selling_price_list()

    conditions = ["item.disabled = 0", "item.is_stock_item = 1"]
    bin_conditions = []
    values = {"selling_price_list": selling_price_list}

    apply_filters(filters, conditions, bin_conditions, values)

    bin_where_clause = f"WHERE {' AND '.join(bin_conditions)}" if bin_conditions else ""
    where_clause = " AND ".join(conditions)
    values.update({"page_start": page_start, "page_length": page_length})

    sortable_fields = {
        "item_code": "item.name",
        "item_name": "item.item_name",
        "custom_collection": "item.custom_collection",
        "custom_finition": "item.custom_finition",
        "custom_type_de_produit": "item.custom_type_de_produit",
        "brand": "item.brand",
        "warehouse": "bin.warehouse",
        "supplier": "item_supplier.supplier",
        "price": "price.price_list_rate",
        "actual_qty": "bin.actual_qty",
        "projected_qty": "bin.projected_qty",
        "reserved_qty": "bin.reserved_qty",
        "indented_qty": "bin.indented_qty",
        "ordered_qty": "bin.ordered_qty",
    }
    sort_field = filters.get("_sort_field")
    sort_order = filters.get("_sort_order") if filters.get("_sort_order") in ("asc", "desc") else "asc"
    sort_expression = sortable_fields.get(sort_field)

    if sort_expression:
        order_by = f"{sort_expression} IS NULL ASC, {sort_expression} {sort_order.upper()}, item.name ASC"
    else:
        order_by = "bin.projected_qty IS NULL ASC, bin.projected_qty ASC, item.name ASC"

    total_count = frappe.db.sql(
        f"""
        SELECT COUNT(*)
        FROM `tabItem` item
        LEFT JOIN (
            SELECT
                item_code,
                CASE
                    WHEN COUNT(DISTINCT warehouse) = 1 THEN MIN(warehouse)
                    ELSE ''
                END AS warehouse,
                SUM(actual_qty) AS actual_qty,
                SUM(indented_qty) AS indented_qty,
                SUM(reserved_qty) AS reserved_qty,
                SUM(ordered_qty) AS ordered_qty,
                SUM(projected_qty) AS projected_qty
            FROM `tabBin`
            {bin_where_clause}
            GROUP BY item_code
        ) bin ON bin.item_code = item.name
        LEFT JOIN (
            SELECT
                parent,
                GROUP_CONCAT(DISTINCT supplier ORDER BY supplier SEPARATOR ', ') AS supplier
            FROM `tabItem Supplier`
            GROUP BY parent
        ) item_supplier ON item_supplier.parent = item.name
        LEFT JOIN `tabItem Price` price
            ON price.name = (
                SELECT item_price.name
                FROM `tabItem Price` item_price
                WHERE item_price.item_code = item.name
                    AND item_price.price_list = %(selling_price_list)s
                    AND item_price.selling = 1
                    AND COALESCE(item_price.customer, '') = ''
                    AND COALESCE(item_price.batch_no, '') = ''
                    AND (item_price.valid_from IS NULL OR item_price.valid_from <= CURDATE())
                    AND (item_price.valid_upto IS NULL OR item_price.valid_upto >= CURDATE())
                ORDER BY
                    CASE WHEN item_price.uom = item.stock_uom THEN 0 ELSE 1 END,
                    item_price.valid_from DESC,
                    item_price.modified DESC
                LIMIT 1
            )
        WHERE {where_clause}
        """,
        values,
    )[0][0]

    result = frappe.db.sql(
        f"""
        SELECT
            item.image,
            item.name AS item_code,
            item.item_name,
            item.custom_collection,
            item.custom_finition,
            item.custom_type_de_produit,
            item.brand,
            bin.warehouse,
            item_supplier.supplier,
            price.price_list_rate AS price,
            price.currency AS price_currency,
            bin.actual_qty,
            bin.indented_qty,
            bin.reserved_qty,
            bin.ordered_qty,
            bin.projected_qty
        FROM `tabItem` item
        LEFT JOIN (
            SELECT
                item_code,
                CASE
                    WHEN COUNT(DISTINCT warehouse) = 1 THEN MIN(warehouse)
                    ELSE ''
                END AS warehouse,
                SUM(actual_qty) AS actual_qty,
                SUM(indented_qty) AS indented_qty,
                SUM(reserved_qty) AS reserved_qty,
                SUM(ordered_qty) AS ordered_qty,
                SUM(projected_qty) AS projected_qty
            FROM `tabBin`
            {bin_where_clause}
            GROUP BY item_code
        ) bin ON bin.item_code = item.name
        LEFT JOIN (
            SELECT
                parent,
                GROUP_CONCAT(DISTINCT supplier ORDER BY supplier SEPARATOR ', ') AS supplier
            FROM `tabItem Supplier`
            GROUP BY parent
        ) item_supplier ON item_supplier.parent = item.name
        LEFT JOIN `tabItem Price` price
            ON price.name = (
                SELECT item_price.name
                FROM `tabItem Price` item_price
                WHERE item_price.item_code = item.name
                    AND item_price.price_list = %(selling_price_list)s
                    AND item_price.selling = 1
                    AND COALESCE(item_price.customer, '') = ''
                    AND COALESCE(item_price.batch_no, '') = ''
                    AND (item_price.valid_from IS NULL OR item_price.valid_from <= CURDATE())
                    AND (item_price.valid_upto IS NULL OR item_price.valid_upto >= CURDATE())
                ORDER BY
                    CASE WHEN item_price.uom = item.stock_uom THEN 0 ELSE 1 END,
                    item_price.valid_from DESC,
                    item_price.modified DESC
                LIMIT 1
            )
        WHERE {where_clause}
        ORDER BY
            {order_by}
        LIMIT %(page_length)s OFFSET %(page_start)s
        """,
        values,
        as_dict=1,
    )

    blank_if_missing_fields = (
        "item_name",
        "custom_collection",
        "custom_finition",
        "custom_type_de_produit",
        "brand",
        "warehouse",
        "supplier",
        "price",
        "price_currency",
        "actual_qty",
        "indented_qty",
        "reserved_qty",
        "ordered_qty",
        "projected_qty",
    )

    # Format image URLs for display and leave missing supply data empty.
    for row in result:
        if row.get("image"):
            row["image"] = f'<img src="{row["image"]}" style="max-width: 100px; max-height: 100px; object-fit: cover;" />'
        else:
            row["image"] = ""

        for fieldname in blank_if_missing_fields:
            if row.get(fieldname) is None:
                row[fieldname] = ""

    # Check for duplicate item_code within the same warehouse
    item_warehouse_map = {}
    for row in result:
        item_code = row.get("item_code")
        warehouse = row.get("warehouse") or "Unknown Warehouse"
        supplier = row.get("supplier") or "Unknown Supplier"

        if item_code:
            # Create a unique key combining item_code and warehouse
            key = (item_code, warehouse)
            if key in item_warehouse_map:
                item_warehouse_map[key].append(supplier)
            else:
                item_warehouse_map[key] = [supplier]

    # Find duplicates (same item_code in same warehouse with multiple suppliers)
    duplicates = {}
    for (item_code, warehouse), suppliers in item_warehouse_map.items():
        if len(suppliers) > 1:
            if item_code not in duplicates:
                duplicates[item_code] = {}
            duplicates[item_code][warehouse] = suppliers

    if duplicates:
        # Prepare the message content
        message_parts = []
        for item_code, warehouses in duplicates.items():
            for warehouse, suppliers in warehouses.items():
                message_parts.append(
                    f"{item_code} (Warehouse: {warehouse}) => {', '.join(suppliers)}"
                )

        message = "<br>".join(message_parts)

        # Show the popup message
        frappe.msgprint(
            title=_("Duplicate Item Codes"),
            msg=_(
                "The following item codes have multiple suppliers in the same warehouse:<br>{0}"
            ).format(message),
            indicator="orange",
        )

    return result, total_count, selling_price_list


def apply_filters(filters, conditions, bin_conditions, values):
    text_filters = {
        "item_code": "item.name",
        "item_name": "item.item_name",
        "custom_collection": "item.custom_collection",
        "custom_finition": "item.custom_finition",
        "custom_type_de_produit": "item.custom_type_de_produit",
        "brand": "item.brand",
        "supplier": "item_supplier.supplier",
    }
    qty_filters = {
        "price": "price.price_list_rate",
        "actual_qty": "bin.actual_qty",
        "projected_qty": "bin.projected_qty",
        "reserved_qty": "bin.reserved_qty",
        "indented_qty": "bin.indented_qty",
        "ordered_qty": "bin.ordered_qty",
    }

    for fieldname, expression in text_filters.items():
        if fieldname in filters and filters.get(fieldname) not in (None, ""):
            add_text_filter(conditions, values, expression, fieldname, filters.get(fieldname))

    if filters.get("warehouse"):
        add_text_filter(bin_conditions, values, "warehouse", "warehouse", filters.get("warehouse"))
        conditions.append("bin.item_code IS NOT NULL")

    for fieldname, expression in qty_filters.items():
        if fieldname in filters and filters.get(fieldname) not in (None, ""):
            add_numeric_filter(conditions, values, expression, fieldname, filters.get(fieldname))


def add_text_filter(conditions, values, expression, fieldname, raw_value):
    value = str(raw_value).strip()
    if not value:
        return

    if value.startswith("!="):
        key = make_filter_key(values, fieldname)
        conditions.append(f"COALESCE({expression}, '') NOT LIKE %({key})s ESCAPE '\\\\'")
        values[key] = f"%{escape_like(value[2:].strip())}%"
        return

    if value.startswith("="):
        key = make_filter_key(values, fieldname)
        conditions.append(f"COALESCE({expression}, '') = %({key})s")
        values[key] = value[1:].strip()
        return

    key = make_filter_key(values, fieldname)
    conditions.append(f"COALESCE({expression}, '') LIKE %({key})s ESCAPE '\\\\'")
    values[key] = f"%{escape_like(value)}%"


def add_numeric_filter(conditions, values, expression, fieldname, raw_value):
    value = str(raw_value).strip()
    if not value:
        return

    if ":" in value and not value.startswith(("=", "!", "<", ">")):
        start, end = value.split(":", 1)
        start_key = make_filter_key(values, f"{fieldname}_start")
        end_key = make_filter_key(values, f"{fieldname}_end")
        conditions.append(f"COALESCE({expression}, 0) BETWEEN %({start_key})s AND %({end_key})s")
        values[start_key] = flt(start)
        values[end_key] = flt(end)
        return

    operators = (">=", "<=", "!=", ">", "<", "=")
    operator = "="
    number = value

    for possible_operator in operators:
        if value.startswith(possible_operator):
            operator = possible_operator
            number = value[len(possible_operator) :].strip()
            break

    key = make_filter_key(values, fieldname)
    conditions.append(f"COALESCE({expression}, 0) {operator} %({key})s")
    values[key] = flt(number)


def make_filter_key(values, fieldname):
    key = fieldname
    index = 1

    while key in values:
        key = f"{fieldname}_{index}"
        index += 1

    return key


def get_selling_price_list():
    return frappe.db.get_single_value("Selling Settings", "selling_price_list") or frappe.db.get_value(
        "Price List",
        {"selling": 1, "enabled": 1},
        "name",
        order_by="name",
    )


def get_filter_options():
    return {
        "custom_collection": get_item_field_options("custom_collection"),
        "custom_finition": get_item_field_options("custom_finition"),
        "custom_type_de_produit": get_item_field_options("custom_type_de_produit"),
        "brand": get_brand_options(),
        "warehouse": get_warehouse_options(),
        "supplier": get_supplier_options(),
    }


def get_item_field_options(fieldname):
    if fieldname not in {
        "custom_collection",
        "custom_finition",
        "custom_type_de_produit",
    }:
        return []

    rows = frappe.db.sql(
        f"""
        SELECT DISTINCT {fieldname} AS value
        FROM `tabItem`
        WHERE disabled = 0
            AND is_stock_item = 1
            AND COALESCE({fieldname}, '') != ''
        ORDER BY {fieldname}
        """,
        as_dict=1,
    )

    return make_options(rows)


def get_brand_options():
    rows = frappe.db.sql(
        """
        SELECT DISTINCT
            item.brand AS value,
            COALESCE(brand.brand, item.brand) AS label
        FROM `tabItem` item
        LEFT JOIN `tabBrand` brand
            ON brand.name = item.brand
        WHERE item.disabled = 0
            AND item.is_stock_item = 1
            AND COALESCE(item.brand, '') != ''
        ORDER BY label
        """,
        as_dict=1,
    )

    return make_options(rows)


def get_warehouse_options():
    rows = frappe.db.sql(
        """
        SELECT DISTINCT
            bin.warehouse AS value,
            COALESCE(warehouse.warehouse_name, bin.warehouse) AS label
        FROM `tabBin` bin
        INNER JOIN `tabItem` item
            ON item.name = bin.item_code
            AND item.disabled = 0
            AND item.is_stock_item = 1
        LEFT JOIN `tabWarehouse` warehouse
            ON warehouse.name = bin.warehouse
        WHERE COALESCE(bin.warehouse, '') != ''
        ORDER BY label
        """,
        as_dict=1,
    )

    return make_options(rows)


def get_supplier_options():
    rows = frappe.db.sql(
        """
        SELECT DISTINCT
            item_supplier.supplier AS value,
            COALESCE(supplier.supplier_name, item_supplier.supplier) AS label
        FROM `tabItem Supplier` item_supplier
        INNER JOIN `tabItem` item
            ON item.name = item_supplier.parent
            AND item.disabled = 0
            AND item.is_stock_item = 1
        LEFT JOIN `tabSupplier` supplier
            ON supplier.name = item_supplier.supplier
        WHERE COALESCE(item_supplier.supplier, '') != ''
        ORDER BY label
        """,
        as_dict=1,
    )

    return make_options(rows)


def make_options(rows):
    return [
        {
            "value": row.value,
            "label": row.get("label") or row.value,
        }
        for row in rows
        if row.value
    ]


def escape_like(value):
    return str(value).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
