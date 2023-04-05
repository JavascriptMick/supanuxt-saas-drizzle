import { ACCOUNT_ACCESS } from '@prisma/client';
import prisma_client from '~~/prisma/prisma.client';
import { FullDBUser } from './service.types';
import { UtilService } from './util.service';

const config = useRuntimeConfig();

export default class AuthService {
  async getFullUserBySupabaseId(supabase_uid: string): Promise<FullDBUser | null> {
    return prisma_client.user.findFirst({ 
      where: { supabase_uid }, 
      include: { memberships: {include: {
        account: true
      }}}
    });
  }

  async getUserById(user_id: number): Promise<FullDBUser | null> {
    return prisma_client.user.findFirstOrThrow({ 
      where: { id: user_id }, 
      include: { memberships: {include: {
        account: true
      }}} 
    });
  }

  async createUser( supabase_uid: string, display_name: string, email: string ): Promise<FullDBUser | null> {
    const trialPlan = await prisma_client.plan.findFirstOrThrow({ where: { name: config.initialPlanName}});
    return prisma_client.user.create({
      data:{
        supabase_uid: supabase_uid,
        display_name: display_name,
        email: email,
        memberships: {
          create: {
            account: {
              create: {
                name: display_name,
                current_period_ends: UtilService.addMonths(new Date(), config.initialPlanActiveMonths),
                plan_id: trialPlan.id,  
                features: trialPlan.features,
                max_notes: trialPlan.max_notes,
                max_members: trialPlan.max_members,
                plan_name: trialPlan.name,
              }
            },
            access: ACCOUNT_ACCESS.OWNER
          }
        }
      },
      include: { memberships: {include: {
        account: true
      }}}
    });
  }

  async deleteUser(user_id: number) {
    return prisma_client.user.delete({ where: { id: user_id } });
  }
}
