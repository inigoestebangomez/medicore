import { SetMetadata } from '@nestjs/common';
import { SKIP_SUBSCRIPTION_CHECK } from '@/api/shared/interceptors/subscription.interceptor';

export const SkipSubscriptionCheck = () => SetMetadata(SKIP_SUBSCRIPTION_CHECK, true);
