export async function initializePayment(email: string, amount: number, plan: string) {
  try {
    const response = await fetch('/api/paystack/initialize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, amount, plan }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to initialize payment');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Payment initialization error:', error);
    throw error;
  }
}
