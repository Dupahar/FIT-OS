export interface GstBreakdown {
  subtotal_paise: number;
  cgst_paise: number;
  sgst_paise: number;
  igst_paise: number;
  total_paise: number;
}

export function calculateGst(
  subtotal_paise: number,
  gst_rate: number,
  is_intra_state: boolean
): GstBreakdown {
  const gst_total = Math.round((subtotal_paise * gst_rate) / 100);

  if (is_intra_state) {
    const half = Math.round(gst_total / 2);
    return {
      subtotal_paise,
      cgst_paise: half,
      sgst_paise: gst_total - half,
      igst_paise: 0,
      total_paise: subtotal_paise + gst_total
    };
  }

  return {
    subtotal_paise,
    cgst_paise: 0,
    sgst_paise: 0,
    igst_paise: gst_total,
    total_paise: subtotal_paise + gst_total
  };
}
