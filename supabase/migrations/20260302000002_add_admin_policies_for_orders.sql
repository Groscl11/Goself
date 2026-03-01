-- Add admin SELECT policy for shopify_orders
CREATE POLICY "Admins can view all orders"
  ON shopify_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
