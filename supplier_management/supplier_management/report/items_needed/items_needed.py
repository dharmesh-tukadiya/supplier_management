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
			"label": _("Actual"),
			"fieldname": "actual_qty",
			"fieldtype": "Float",
			"width": 90,
		},
		{
			"label": _("Requested"),
			"fieldname": "indented_qty",
			"fieldtype": "Float",
			"width": 90,
		},
		{
			"label": _("Reserved"),
			"fieldname": "reserved_qty",
			"fieldtype": "Float",
			"width": 90,
		},
		{
			"label": _("Ordered"),
			"fieldname": "ordered_qty",
			"fieldtype": "Float",
			"width": 90,
		},
		{
			"label": _("Projected"),
			"fieldname": "projected_qty",
			"fieldtype": "Float",
			"width": 90,
		},
	]
	return columns


def get_data(filters):
	bin_table = frappe.qb.DocType("Bin")
	item_table = frappe.qb.DocType("Item")

	query = (
		frappe.qb.from_(bin_table)
		.inner_join(item_table)
		.on(bin_table.item_code == item_table.name)
		.select(
			bin_table.item_code,
			bin_table.warehouse,
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

	return query.run(as_dict=1)