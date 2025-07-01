// Copyright (c) 2013, Frappe Technologies Pvt. Ltd. and contributors
// For license information, please see license.txt

frappe.query_reports["Items Needed"] = {
	filters: [
		{
			fieldname: "item_code",
			label: __("Item"),
			fieldtype: "Link",
			options: "Item",
		},
		{
			fieldname: "warehouse",
			label: __("Warehouse"),
			fieldtype: "Link",
			options: "Warehouse",
		},
	],

	columns: [
		{
			label: __("Item"),
			fieldname: "item_code",
			fieldtype: "Link",
			options: "Item",
			width: 120,
		},
		{
			label: __("Warehouse"),
			fieldname: "warehouse",
			fieldtype: "Link",
			options: "Warehouse",
			width: 120,
		},
		{
			label: __("Actual"),
			fieldname: "actual_qty",
			fieldtype: "Float",
			width: 90,
		},
		{
			label: __("Requested"),
			fieldname: "indented_qty",
			fieldtype: "Float",
			width: 90,
		},
		{
			label: __("Reserved"),
			fieldname: "reserved_qty",
			fieldtype: "Float",
			width: 90,
		},
		{
			label: __("Ordered"),
			fieldname: "ordered_qty",
			fieldtype: "Float",
			width: 90,
		},
		{
			label: __("Projected"),
			fieldname: "projected_qty",
			fieldtype: "Float",
			width: 90,
		},
	],
};