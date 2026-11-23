"""Offline planning tests; no WeCom calls, production archives or message sending."""
from datetime import datetime
from pathlib import Path
import copy
import importlib.util
import unittest

spec=importlib.util.spec_from_file_location('doc_sync',Path(__file__).with_name('wecom-doc-sync.py'))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

def table(hour=11):
    cells=[[None]*26 for _ in range(20)]
    cells[17][2:26]=m.HEADERS
    day=datetime(2026,11,21)
    cells[19][0]=(day-datetime(1899,12,30)).days+hour/24
    cells[19][2]=(day-datetime(1899,12,30)).days
    cells[19][3]='截止到 '+str(hour)+' 点'
    return cells

def source(hour=11):
    return {'rows':[{'date':'2026-11-21','time':f'{hour:02}:00','values':['2026-11-21','截至北京时间 '+str(hour)+' 点',12,20,*([None]*20)]}]}

class DocSyncTests(unittest.TestCase):
    def test_ten_skipped_eleven_and_twentyfour_included(self):
        self.assertEqual(m.plan_updates(table(10),source(10))['changes'],[])
        self.assertEqual(len(m.plan_updates(table(11),source(11))['changes']),2)
        self.assertTrue(m.eligible(('2026-11-20','24:00')))

    def test_previous_closing_retention_refreshes_existing_values_only(self):
        cells=table(24);src=source(24)
        cells[19][4]=999
        cells[19][24]=0.1;cells[19][25]=0.2
        src['rows'][0]['values'][22:24]=[0.75,0.4]
        plan=m.plan_updates(cells,src,retention_date='2026-11-21')
        refresh=[x for x in plan['changes'] if x['refresh']]
        self.assertEqual([(x['col'],x['value']) for x in refresh],[(25,0.75),(26,0.4)])
        self.assertFalse(any(x['col']==5 for x in plan['changes']))
        self.assertFalse(any(x['refresh'] for x in m.plan_updates(cells,src,retention_date='2026-11-20')['changes']))
        group=next(g for g in m.batches(plan['changes']) if g['refresh'])
        self.assertEqual(group['range'],'Y20:Z20')
        self.assertEqual(group['previous'],[[0.1,0.2]])

    def test_retention_refresh_preserves_zero_missing_and_formulas(self):
        cells=table(24);src=source(24)
        cells[19][24]=0.5;cells[19][25]={'value':0.2,'formula':'=A1'}
        src['rows'][0]['values'][22:24]=[0,0.4]
        changes=m.plan_updates(cells,src,retention_date='2026-11-21')['changes']
        self.assertEqual([(x['col'],x['value']) for x in changes if x['refresh']],[(25,0)])
        src['rows'][0]['values'][22]=None
        self.assertFalse(any(x['refresh'] for x in m.plan_updates(cells,src,retention_date='2026-11-21')['changes']))

    def test_midnight_belongs_to_previous_day(self):
        serial=(datetime(2026,11,22)-datetime(1899,12,30)).days
        self.assertEqual(m.serial_slot(serial),('2026-11-21','24:00'))

    def test_existing_zero_and_formula_are_not_missing(self):
        cells=table();cells[19][4]=0;cells[19][5]={'value':'','formula':'=A1'}
        before=copy.deepcopy(cells)
        plan=m.plan_updates(cells,source())
        self.assertEqual(plan['changes'],[])
        self.assertEqual(plan['protectedFormulaCells'],1)
        self.assertEqual(cells,before)

    def test_placeholder_can_be_completed_without_touching_existing_data(self):
        cells=table();cells[19][4]='-';cells[19][5]=88
        changes=m.plan_updates(cells,source())['changes']
        self.assertEqual(len(changes),1)
        self.assertEqual(changes[0]['col'],5)
        self.assertTrue(changes[0]['overwrite'])

    def test_stored_empty_string_requires_guarded_overwrite(self):
        cells=table();cells[19][4]='';cells[19][5]=55
        changes=m.plan_updates(cells,source())['changes']
        self.assertEqual(len(changes),1)
        self.assertTrue(changes[0]['overwrite'])

    def test_reference_style_preserves_percentage_and_formats_cost(self):
        reference=[{} for _ in range(26)]
        reference[19]={'style':{'number_format':'0.00%','font_size':10,'font_family':''}}
        self.assertEqual(m.reference_style(reference,20)['number_format'],'0.00%')
        self.assertNotIn('font_family',m.reference_style(reference,20))
        self.assertEqual(m.reference_style(reference,18)['number_format'],'0.00')

    def test_unmatched_history_and_future_are_not_fabricated(self):
        src=source();src['rows'][0]['date']='2026-11-20'
        self.assertEqual(m.plan_updates(table(),src)['changes'],[])

    def test_header_or_helper_mismatch_stops(self):
        cells=table();cells[17][4]='另一个指标'
        with self.assertRaises(m.SyncError):m.plan_updates(cells,source())
        cells=table();cells[19][0]+=1/24
        with self.assertRaises(m.SyncError):m.plan_updates(cells,source())

    def test_batches_are_bounded_and_do_not_include_other_cells(self):
        changes=[{'row':r,'col':c,'value':r+c,'key':['2026-11-21','11:00'],'overwrite':False} for r in range(20,90) for c in [5,6,9,10]]
        groups=m.batches(changes)
        self.assertEqual(sum(sum(len(row) for row in g['cells']) for g in groups),len(changes))
        self.assertTrue(all(sum(len(row) for row in g['cells'])<=400 for g in groups))
        self.assertTrue(all((g['left'],g['right']) in [(5,6),(9,10)] for g in groups))

if __name__=='__main__':unittest.main()
