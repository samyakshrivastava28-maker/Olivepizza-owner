import axios from 'axios';

export interface VeriphoneResponse {
  status: string;
  phone: string;
  phone_valid: boolean;
  phone_type?: string;
  phone_region?: string;
  country?: string;
  country_code?: string;
  country_prefix?: string;
  international_number?: string;
  local_number?: string;
  e164?: string;
  carrier?: string;
  mode?: string;
  timezone?: string[];
  geographical?: boolean;
}

export class VeriphoneService {
  private static instance: VeriphoneService;
  private apiKey: string;
  private apiUrl: string = 'https://api.veriphone.io/v2/verify';

  private constructor() {
    this.apiKey = process.env.VERIPHONE_API_KEY || '9A278366811B4244AB0A1C1A06A3AEC4';
  }

  public static getInstance(): VeriphoneService {
    if (!VeriphoneService.instance) {
      VeriphoneService.instance = new VeriphoneService();
    }
    return VeriphoneService.instance;
  }

  public isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  public async verifyNumber(phone: string): Promise<VeriphoneResponse> {
    if (!this.apiKey) {
      throw new Error('Veriphone API key is missing.');
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      phone: phone.trim()
    });

    const response = await axios.get<VeriphoneResponse>(`${this.apiUrl}?${params.toString()}`, {
      timeout: 8000
    });

    return response.data;
  }
}

export const veriphoneService = VeriphoneService.getInstance();
