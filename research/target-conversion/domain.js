// Production research concepts; no case-specific types or answer literals.
export const categories=['revenue','growth','revenue_concentration','customer_concentration','top_customer_concentration','debt','cash','cash_flow','capex','backlog_rpo','guidance','liquidity','operating_history','compute_spend','risk_factors','integrity_legal_reporting'];
export const concepts=['consolidated_revenue','geographic_revenue','cost_of_revenue','technology_infrastructure_expense','unsatisfied_rpo','interest_rate_sensitivity','revenue_yoy_growth','significant_customer_share','top1_revenue_share','cash_balance','operating_cash_flow','debt_balance','capital_expenditure','revenue_guidance'];
export const unitFamilies={consolidated_revenue:'USD',geographic_revenue:'USD',cost_of_revenue:'USD',technology_infrastructure_expense:'USD',unsatisfied_rpo:'USD',interest_rate_sensitivity:'USD',revenue_yoy_growth:'percent',significant_customer_share:'percent',top1_revenue_share:'percent',cash_balance:'USD',operating_cash_flow:'USD',debt_balance:'USD',capital_expenditure:'USD',revenue_guidance:'USD'};
export function rowConcept(support){
 const row=support.rowLabel.replace(/\s*\(\d+\)\s*$/,'').trim().toLowerCase();
 if(row==='revenue')return /%\s*change/i.test(support.headerPath.join(' '))?'revenue_yoy_growth':'consolidated_revenue';
 if(['united states','all other countries'].includes(row)&&/revenue by geographic/i.test(support.tableTitle??''))return 'geographic_revenue';
 const rows={'cost of revenue':'cost_of_revenue','technology and infrastructure':'technology_infrastructure_expense','cash and cash equivalents':'cash_balance','net cash provided by operating activities':'operating_cash_flow','total debt':'debt_balance','capital expenditures':'capital_expenditure'};
 return rows[row]??null; // Unknown labels require semantic proposal, never guessed.
}
